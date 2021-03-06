(function() {
  'use strict';

  angular
    .module('LandApp')
    .factory('firebaseLayerService', firebaseLayerService);

  /** @ngInject */
  function firebaseLayerService(ol, $q,
      firebaseReferenceService, messageService, activeProjectService) {

    var service = {
      saveDrawingLayers: saveDrawingLayers,
      saveFarmLayers: saveFarmLayers
    };

    return service;

    //////////////// PUBLIC ////////////////

    function saveDrawingLayers(layersList, isBaseFarmLayer) {
      return _saveLayer(layersList, "drawing", isBaseFarmLayer);
    }

    function saveFarmLayers(layersList, isBaseFarmLayer) {
      return _saveLayer(layersList, "farm", isBaseFarmLayer);
    }

    //////////////// PRIVATE ////////////////

    function _saveLayer(layersList, layerGroupName, isBaseFarmLayer) {
      var deferred = $q.defer();

      var format = new ol.format.GeoJSON();
      var payload = {};

      angular.forEach(layersList, function(layer) {
        payload[layer.key] = angular.copy(
          format.writeFeaturesObject(layer.olLayer.getSource().getFeatures())
        );
      });

      var projectKey = isBaseFarmLayer ? "myFarm" : activeProjectService.getActiveProjectKey();

      var promise = firebaseReferenceService.getUserLayersRef(projectKey)
        .child(layerGroupName)
        .update(payload);

      promise
        .then(deferred.resolve)
        .catch(function(error) {
          deferred.reject(error);
          messageService.error(error);
        });

      return deferred.promise;
    }

  }

})();
