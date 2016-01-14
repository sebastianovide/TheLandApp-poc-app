(function() {
  'use strict';

  angular
    .module('LandApp')
    .service('mapService', mapService);

  /** @ngInject */
  function mapService(ol, proj4, $log, $http, $mdToast, $timeout, $window, firebaseService, layersService) {
    // define EPSG:27700
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs");

    // TODO: remove this hard code
    // var timsFarm = ol.proj.fromLonLat([-0.658493, 51.191286]);
    var jamesFarm = ol.proj.fromLonLat([-1.315305, 51.324901]);

    var osLayers = {};  // name: ol's layer
    var currentBaseMap = {};
    var view = {};
    var map = {};
    var drawingTools = layersService.drawingTools;
    var enableDrawing = false;
    var drawingLayers = {};

    firebaseService.firebaseRef.onAuth(loadUserLayers);

    var service = {
      createMap: createMap,
      setBaseMap: setBaseMap,
      fitExtent: fitExtent,
      toggleLayerFromCheckProperty: toggleLayerFromCheckProperty,
      zoomIn: zoomIn,
      zoomOut: zoomOut,
      editToggleDrawingTool: editToggleDrawingTool,
      setVisibleDrawingToolLayer: setVisibleDrawingToolLayer,
      drawingTools: drawingTools,
      deactivateAllDrawingTools: deactivateAllDrawingTools,
      isAnyDrawingToolActive: isAnyDrawingToolActive,
      getEnableDrawing: function() {return enableDrawing;},
      addControlInteractions: addControlInteractions
    };

    var layerIndexes = {
      baseMap : -2,
      external : -1
    };

    return service;

    ///////////////
    function loadUserLayers(authData) {
      if (authData) {
        firebaseService.getUserLayersRef().once("value", function(userLayers) {
          $log.debug(userLayers);

          drawingLayers = [];

          var layers = userLayers.val();
          var format = new ol.format.GeoJSON();
          var extent = ol.extent.createEmpty();

          drawingLayers = drawingTools.reduce(function(obj, curr) {
            obj[curr.name] = newVectorLayer(curr.name, curr.colour, curr.strokeWidth);
            map.addLayer(obj[curr.name]);

            if (layers && layers[curr.name] && layers[curr.name].features) {
              var features = format.readFeatures(layers[curr.name]);
              obj[curr.name].getSource().addFeatures(features);
              ol.extent.extend(extent, obj[curr.name].getSource().getExtent());
            }

            return obj;
          }, {});

          fitExtent(extent);
          $timeout(function() {enableDrawing = true;});
        });
      } else {
        enableDrawing = false;
      }
    }

    function fitExtent(extent) {
      // Britisg extend
      // Latitude: 60.8433° to 49.9553°
      // Longitude: -8.17167° to 1.74944°

      // Easting: 64989
      // Northing: 1233616
      //
      // Easting: 669031
      // Northing: 12862

      if (!ol.extent.isEmpty(extent)) {
        view.fit(extent, map.getSize());
      }
    }

    function isAnyDrawingToolActive() {
      return drawingTools
        .filter(function(dt) { return dt.hasOwnProperty('draw');} )
        .length > 0;
    }

    function deactivateAllDrawingTools() {
      drawingTools
        .filter(function(dt) { return dt.hasOwnProperty('draw');} )
        .forEach(deactivateDrawingTool);
    }

    function newVectorLayer(name, colour, strokeWidth) {
      return new ol.layer.Vector({
        source: new ol.source.Vector({}),
        style: new ol.style.Style({
          fill: new ol.style.Fill({
            color: "rgba(" + colour +  ", 0.15)"
          }),
          stroke: new ol.style.Stroke({
            color: "rgba(" + colour +  ", 0.9)",
            width: strokeWidth
          }),
          image: new ol.style.Circle({
            radius: 7,
            fill: new ol.style.Fill({
              color: "rgba(" + colour +  ", 0.9)"
            })
          })
        })
      });
    }

    function unfocusLayer(layer) {
      map.getLayers().getArray()
        .filter(function(l) { return l !== layer; })
        .forEach(function(l) {
            l.setOpacity(l.oldOpacity || 1);
            delete l.oldOpacity;
        });
    }

    function focusLayer(layer) {
      map.getLayers().getArray()
        .filter(function(l) { return l !== layer; })
        .forEach(function(l) {
            l.oldOpacity = l.getOpacity();
            l.setOpacity(0.5);
        });
    }

    function editToggleDrawingTool(tool) {
      if (tool.draw) {
        deactivateDrawingTool(tool);
      } else {
        activateDrawingTool(tool);
      }
    }

    function deactivateDrawingTool(tool) {
        $log.debug('deactivate', tool);

        if (tool.active) {
          saveDrawingLayers(tool.name);

          tool.active = false;
          map.removeInteraction(tool.draw);
          delete tool.draw;
          unfocusLayer(drawingLayers[tool.name]);
        }

        setVisibleDrawingToolLayer(tool);
    }

    /**
     * Saves the current drawing layers to the database.
     *
     * @param {string|undefined} singleLayerName If defined, will only save this named layer.
     */
    function saveDrawingLayers(singleLayerName) {
      var format = new ol.format.GeoJSON();

      angular.forEach(drawingLayers, function(layer, layerName) {
        if (angular.isDefined(singleLayerName) && (layerName !== singleLayerName)) {
          return;
        }

        var payload = format.writeFeaturesObject(layer.getSource().getFeatures());

        firebaseService.getUserLayersRef().child(layerName).set(payload);
      });
    }

    function activateDrawingTool(tool) {
        $log.debug('activate', tool);

        drawingTools.forEach(function(dt){
          deactivateDrawingTool(dt);
        });

        tool.active = true;

        tool.draw = new ol.interaction.Draw({
            //features: this.$scope.drawingLayers[tool.name].getSource().getFeatures(),
            source: drawingLayers[tool.name].getSource(),
            type: tool.type,
            style: new ol.style.Style({
                fill: new ol.style.Fill({
                    color: "rgba(" + tool.colour +  ", 0.15)"
                }),
                stroke: new ol.style.Stroke({
                    color: "rgba(" + tool.colour +  ", 0.9)",
                    width: tool.strokeWidth
                }),
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({
                        color: "rgba(" + tool.colour +  ", 0.9)"
                    })
                })
            })
        });
        map.addInteraction(tool.draw);
        focusLayer(drawingLayers[tool.name]);
        $mdToast.show({
            template: '<md-toast>Start drawing some ' + tool.name + '!</md-toast>',
            hideDelay: 5000,
            position: "top right"
        });

        drawingLayers[tool.name].setVisible(true);
    }

    function zoomIn() {
      view.setZoom(view.getZoom() + 1);
    }

    function zoomOut() {
      view.setZoom(view.getZoom() - 1);
    }

    function createMap() {
      view = new ol.View({
        center: jamesFarm,
        maxZoom: 20,
        minZoom: 7,
        zoom: 13
      });

      map = new ol.Map({
        target: 'map',
        layers: [],
        loadTilesWhileAnimating: true,
        view: view,
        controls: []
      });
    }

    /**
     * Enables the following drawing layer interactions:
     *  - removing features (by clicking and pressing backspace)
     *  - modifying features (adding/moving attributes)
     */
    function addControlInteractions() {
      var selectInteraction = new ol.interaction.Select({
            condition: function(event) {
              return ol.events.condition.singleClick(event) && !isAnyDrawingToolActive();
            }
          }),
          modifyInteraction = new ol.interaction.Modify({
            features: selectInteraction.getFeatures()
          }),
          selectedFeatures = [];

      selectInteraction.on("select", function(e) {
        selectedFeatures = e.selected;
      });

      map.addInteraction(modifyInteraction);
      map.addInteraction(selectInteraction);

      // wait for the backspace keydown event to fire
      // to remove features from the map
      angular.element($window).bind("keydown", function(e) {
        var keyCode = e.which || e.keyCode;

        if (selectedFeatures.length && keyCode === 8) { // backspace key
          var wasSomethingRemoved = false;

          // find parent layers and remove the selected features from them
          angular.forEach(selectedFeatures, function(feature) {
            angular.forEach(drawingLayers, function(layer) {
              if (layer.getSource().getFeatures().indexOf(feature) > -1) {
                layer.getSource().removeFeature(feature);
                wasSomethingRemoved = true;
              }
            });
          });

          if (wasSomethingRemoved) {
            saveDrawingLayers();
            selectInteraction.getFeatures().clear();
            e.preventDefault();
          }
        }
      });
    }

    function addLayer(layer) {
      buildAndCacheLayer(layer);
      map.addLayer(osLayers[layer.name]);
    }

    function removeLayer(layer) {
      buildAndCacheLayer(layer);
      map.removeLayer(osLayers[layer.name]);
    }

    function toggleLayerFromCheckProperty(layer) {
      if (layer.checked) {
        addLayer(layer);
      } else {
        removeLayer(layer);
      }
    }

    function buildAndCacheLayer(layer) {
      if (!osLayers[layer.name]) {
        switch (layer.type) {
          case 'base.mapbox':
            osLayers[layer.name] = new ol.layer.Tile({
              zIndex: layerIndexes.baseMap,
              source: new ol.source.XYZ({
                url: layer.url
              })
            });
            break;
          case 'base.osm':
            osLayers[layer.name] = new ol.layer.Tile({
              zIndex: layerIndexes.baseMap,
              source: new ol.source.OSM()
            });
            break;
          case 'base.mapquest':
            osLayers[layer.name] = new ol.layer.Tile({
              zIndex: layerIndexes.baseMap,
              source: new ol.source.MapQuest({layer: 'osm'})
            });
            break;
          case 'wms':
            osLayers[layer.name] = new ol.layer.Tile({
              zIndex: layerIndexes.external,
              source: new ol.source.TileWMS({
                url: layer.url,
                params: {'LAYERS': layer.layers, 'TILED': true}
              })
            });
            break;
          case 'vector':
            osLayers[layer.name] = new ol.layer.Vector({
              zIndex: layerIndexes.external,
              source: new ol.source.Vector({
                url: layer.url,
                format: new ol.format.GeoJSON({
                  defaultDataProjection: "EPSG:27700"
                })
              }),
              style: new ol.style.Style({
                fill: new ol.style.Fill({
                  color: layer.fillColor,
                }),
                stroke: new ol.style.Stroke({
                  color: layer.strokeColor,
                  width: 2
                })
              })
            });
            break;
          case 'vectorspace':
            osLayers[layer.name] = new ol.layer.Vector({
              zIndex: layerIndexes.external,
              maxResolution: 5,
              source: new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                strategy: ol.loadingstrategy.bbox,
                loader: function (extent, resolution, projection) {
                  // wgs84
                  extent = ol.proj.transformExtent(extent, "EPSG:3857", "EPSG:4326");

                  $http.get(layer.url, {
                      headers : {
                          "Accept": "application/json;srid=4326"
                      },
                      params : {
                        "bbox" : extent.join() + ",4326"
                      }
                    })
                    .then(function successCallback(response) {
                      if (response.data) {
                        var features = (new ol.format.GeoJSON())
                          .readFeatures(response.data, {
                              dataProjection: "EPSG:4326",
                              featureProjection: projection
                            });
                        var src = osLayers[layer.name].getSource();
                        src.addFeatures(features);
                        $log.debug('new featurecount:', src.getFeatures().length);
                      }
                    }, function errorCallback(response) {
                      $log.debug(response);
                    });
                }
                //useSpatialIndex: true
              })
            });
            break;
          default:
            $log.debug("layer type '" + layer.type + "' not defined");
        }
      }
    } //buildAndCacheLayer

    function setBaseMap(baseMap) {
      removeLayer(currentBaseMap);
      currentBaseMap = baseMap;
      addLayer(currentBaseMap);
    }

    /** Hide/Unhide drawing tool layer based on tool being checked.
    */
    function setVisibleDrawingToolLayer(tool) {
      var layer = drawingLayers[tool.name];
      layer.setVisible(tool.checked);
    }

  } // mapService


})();
