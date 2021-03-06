/**
 * Manages and allows for interacting with grouped OL layers,
 * where each group is an individual project.
 */
(function() {
  'use strict';

  angular
    .module('LandApp')
    .factory('olLayerGroupService', olLayerGroupService);

  /** @ngInject */
  function olLayerGroupService(ol, mapService, activeProjectService) {
    var service = {
      createLayerGroup: createLayerGroup,
      setGroupVisibility: setGroupVisibility,
      getActiveLayerGroup: getActiveLayerGroup,
      getBaseFarmLayerGroup: getBaseFarmLayerGroup,
      getActiveLayerByKey: getActiveLayerByKey,
      getLayerDefintions: function() { return _layerDefinitions; },
      isBaseFarmLayerVisible: isBaseFarmLayerVisible
    };

    var _groupCollection = {};
    var _layerDefinitions = {};

    return service;

    ////////////////////////////////// PUBLIC //////////////////////////////////

    /**
     * Creates a new group of layers and appends them to the map.
     * The group is invisible by default.
     *
     * @param  {String}            groupName        Name of the group
     * @param  {ol.layer.Vector[]} layerList        Array of layers
     * @param  {Object}            layerDefinitions Object of all layer definitions
     * @return {ol.layer.Group}                     Newly created group
     */
    function createLayerGroup(groupName, layerList, layerDefinitions) {
      var group = new ol.layer.Group({
        layers: layerList,
        visible: false
      });

      mapService.getMap().addLayer(group);
      _groupCollection[groupName] = group;
      _layerDefinitions[groupName] = layerDefinitions;

      return group;
    }

    /**
     * Returns a collection of the active group layers.
     * @return {Object} Object of layer definition objects, grouped by type
     */
    function getActiveLayerGroup() {
      return _layerDefinitions[activeProjectService.getActiveProjectKey()];
    }

    /**
     * Returns the base farm group object
     * @return {Object} Group definition object
     */
    function getBaseFarmLayerGroup() {
      return _layerDefinitions.myFarm;
    }

    /**
     * Returns a specific named layer from the active group.
     *
     * @param  {String}  layerKey       Layer name/key
     * @param  {Boolean} isDrawingLayer Is this a drawing layer?
     * @return {Object}                 Layer definition object
     */
    function getActiveLayerByKey(layerKey, isDrawingLayer) {
      var subKey = isDrawingLayer ? "drawingLayers" : "farmLayers";

      return _layerDefinitions[activeProjectService.getActiveProjectKey()][subKey][layerKey];
    }

    /**
     * Returns true if the base farm layer group is visible, false otherwise.
     * @return {Boolean}  Layer visibility
     */
    function isBaseFarmLayerVisible() {
      return _groupCollection.myFarm && _groupCollection.myFarm.getVisible();
    }

    /**
     * Toggles the visiblity of a named layer group.
     *
     * @param  {String}  groupName Name/key of the project/group
     * @param  {Boolean} isVisible Whether the group is visible
     */
    function setGroupVisibility(groupName, isVisible) {
      // TODO: remove this if. _groupCollection[groupName] could be undefined as there is some
      // async initialization done in the wrong place.
      if (_groupCollection[groupName]) {
        _groupCollection[groupName].setVisible(isVisible);
      }
    }
  }
})();
