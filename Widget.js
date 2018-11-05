///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2018 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// app config.json:
//
// "widgetOnScreen": {
//   "widgets": [
//     {
//       "uri": "widgets/MCSC/Headless/Widget",
//       "version": "2.9",
//       "id": "widgets_Headless_Widget_2",
//       "name": "Headless",
//       "position": {
//         "relativeTo": "map"
//       }
//     }

///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'jimu/BaseWidget',
    /*"esri/dijit/HomeButton",*/
    "esri/geometry/Extent",
    'esri/SpatialReference',
    'dojo/_base/html',
    'dojo/dom-construct',
    'dojo/topic',
    'dojo/on',
    "dojo/Deferred",
    "esri/tasks/query",
    "esri/request"
  ],
  function(
    declare,
    lang,
    BaseWidget,
    /*HomeButton,*/
    Extent,
    SpatialReference,
    html,
    domConstruct,
    topic,
    on,
    Deferred,
    Query,
    esriRequest) {
    var clazz = declare([BaseWidget], {

      name: 'Headless',
      baseClass: 'jimu-widget-homebutton',

      moveTopOnActive: false,
      _queryOID: null,
      _editingAttachmentUrls: false,

      postCreate: function() {
        this.own(topic.subscribe("appConfigChanged", lang.hitch(this, this.onAppConfigChanged)));
      },

      onSignIn: function(credential){
        /* jshint unused:false*/
        console.log('onSignIn');
        this._token = credential.token;
      },

      _updateFeatureWithNewAttachmentUrl: function(params){
        
        this.attachmentUrl = this.config.attachmentBaseUrl + "/" + params.objectId + "/attachments/" + params.attachmentId;
 
        var query = new Query();
        query.objectIds = [params.objectId];
        query.outFields = [ "*" ];
        
        // Query for the features with the given object ID
        this.casesFeatureLayer.queryFeatures(query, lang.hitch(this, function(featureSet) {
          console.log(featureSet);
          console.log(this.attachmentUrl);
          
          var feature = featureSet.features[0];

          if(feature){
            feature.attributes["pic_url"] = this.attachmentUrl;
            feature.attributes["thumb_url"] = this.attachmentUrl;

            this._editingAttachmentUrls = true;
            this.casesFeatureLayer.applyEdits(null, [feature], null, lang.hitch(this, function(adds, deletes, updates) { 
              console.log(updates);
            }), lang.hitch(this, function(evt){
              console.log(evt);
            }));
          }
        }));
       },

      startup: function() {
        var initalExtent = null;
        this.inherited(arguments);
        
        this.casesFeatureLayer = this.map.getLayer(this.map.graphicsLayerIds[this.appConfig.mcsc.casesLayerIndex]);
        
        this.casesFeatureLayer.on("add-attachment-complete", lang.hitch (this,function(evt) 
        {
          console.log(evt);
          if(evt.result.success === true)
          {
            this._updateFeatureWithNewAttachmentUrl(evt.result);
            
          }
        }));  

        this.casesFeatureLayer.on("edits-complete", lang.hitch (this,function(evt) 
        {
          console.log("edits-complete");
          console.log(evt);

          if(this._editingAttachmentUrls){
            this._editingAttachmentUrls = false;
            return;
          }

          var query = new Query();
          query.objectIds = [evt.updates[0].objectId];
          this._queryOID = evt.updates[0].objectId;

          query.outFields = [ "EditDate" ];
          // Query for the features with the given object ID
          this.casesFeatureLayer.queryFeatures(query, lang.hitch(this, function(featureSet) {
            console.log(featureSet.features[0].attributes.casestatus);

            if(featureSet.features[0].attributes[this.config.statusFieldName] === this.config.statusTargetValue)
            {
              this._queryGeometry = featureSet.features[0].geometry;

              this._getStoryMapLink().then(lang.hitch (this, function(results){
                console.log(results);
                this._postChangesToStoryMap(results);
                
              }));
            }
            // var d1 = Date(featureSet.features[0].attributes.EditDate);
            // var d2 = Date(featureSet.features[0].attributes.CreationDate);
            // var diff = Math.abs(d1.getTime() - d2.getTime());
            // console.log(diff);

            var hours = Math.ceil((featureSet.features[0].attributes.EditDate - featureSet.features[0].attributes.CreationDate) / (1000 * 3600 /* * 24*/));
            console.log(hours + " hrs");
            if (hours > 24)
            {
              //https://developers.arcgis.com/javascript/3/jsapi/featurelayer-amd.html#applyedits
            }
            
            //console.log(Date(featureSet.features[0].attributes.EditDate));
            //console.log(featureSet.features[0].attributes.PRENAME + ": " + featureSet.features[0].attributes.MCSC_APPID);
          }));


        }));

        return;

        this.own(on(this.map, 'extent-change', lang.hitch(this, 'onExtentChange')));

        var configExtent = this.appConfig && this.appConfig.map &&
          this.appConfig.map.mapOptions && this.appConfig.map.mapOptions.extent;

        if (configExtent) {
          initalExtent = new Extent(
            configExtent.xmin,
            configExtent.ymin,
            configExtent.xmax,
            configExtent.ymax,
            new SpatialReference(configExtent.spatialReference)
          );
        } else {
          initalExtent = this.map._initialExtent || this.map.extent;
        }

        this.createHomeDijit({
          map: this.map,
          extent: initalExtent
        });
      },

      _postChangesToStoryMap: function(content){
        
        //content.response.values.order[0].visible = false;

        //this._queryOID = 0;
        var newOrder = [];
        for (var i = 0, len = content.response.values.order.length; i < len; i++) {
          
          if (content.response.values.order[i].id !== this._queryOID) {
            newOrder.push(content.response.values.order[i]);
          }
        }
        console.log(content.response.values.order);
        content.response.values.order = newOrder;
        console.log(content.response.values.order);

        //https://mcsc.maps.arcgis.com/sharing/rest/content/users/menglish_mcsc///items/2cb73f9463cb45bfbfbdc19aa5b56371/update
        //"/sharing/rest/content/users/menglish_mcsc/items/"
        
        var storymapRequest = esriRequest({
          url: this.appConfig.portalUrl + "/sharing/rest/content/users/"+ this.config.storymapOwner_Username + "/items/"+ content.appid +"/update",
          content: { f: "json", /*token: this._token*/
          text: JSON.stringify(content.response)},
          handleAs: "json"/*,
          callbackParamName: "callback"*/
        },
        {
          usePost: true
        });
        storymapRequest.then(lang.hitch (this,
          function(response) {
            console.log(response);
            //console.log("Success: ", response.layers);
        }), lang.hitch (this,function(error) {
            console.log("Error: ", error.message);
        }));
      },

      _getStoryMapLink: function(){

        var deferred = new Deferred;
  
        this._queryForStoryMapid().then(lang.hitch(this, function(appid) {
  
          //console.log(appid);
          //appid = "2cb73f9463cb45bfbfbdc19aa5b56371";
  
          var layersRequest = esriRequest({
            url: this.appConfig.portalUrl + "/sharing/rest/content/items/"+ appid +"/data",
            content: { f: "json" },
            handleAs: "json",
            callbackParamName: "callback"
          });
          layersRequest.then(lang.hitch (this,
            function(response) {
              console.log(response);
              var index = response.values.order.length;
  
              var found = false;
              for (var i = 0; i < response.values.order.length; i++)
              {
                if(response.values.order[i].id === this._queryOID)
                {
                  found = true;
                  deferred.resolve({appid: appid, index: i + 1, response: response});
                }
              }
                 
              if(!found)
                deferred.resolve({appid: appid, index: 9999, response: response});
              
              //console.log("Success: ", response.layers);
          }), lang.hitch (this,function(error) {
              console.log("Error: ", error.message);
          }));
  
        
  
            //https://mcsc.maps.arcgis.com/sharing/rest/content/items/7521054e318f492eb13be4a2613122c8/data?f=json
            //return result;
  
        }));
  
        return deferred.promise;
      },
  
      _queryForStoryMapid: function()
      {
        var deferred = new Deferred;
  
        if(this._queryGeometry === undefined)
          return;
  
        var query = new Query();
        //query.objectIds = [0];
  
        var extent = new esri.geometry.Extent({
          "xmin":this._queryGeometry.x ,"ymin":this._queryGeometry.y,"xmax":this._queryGeometry.x + 100,"ymax":this._queryGeometry.y + 100,
          "spatialReference":{"wkid":this.map.spatialReference.wkid}
        });
  
        query.geometry = extent; // this.map.extent; // this._queryGeometry;
        query.outFields = [ "*" ];
        // Query for the features with the given object ID
        var fLayer = this.map.getLayer(this.map.graphicsLayerIds[this.appConfig.mcsc.provincesLayerIndex]); 
        fLayer.queryFeatures(query, lang.hitch(this, function(featureSet) {
          console.log(featureSet.features[0].attributes.PRENAME + ": " + featureSet.features[0].attributes.MCSC_APPID);
          deferred.resolve(featureSet.features[0].attributes.MCSC_APPID);
        }));
  
        return deferred.promise;
  
      },

      createHomeDijit: function(options) {
        this.homeDijit = new HomeButton(options, domConstruct.create("div"));
        this.own(on(this.homeDijit, 'home', lang.hitch(this, 'onHome')));
        html.place(this.homeDijit.domNode, this.domNode);
        this.homeDijit.startup();
      },

      onAppConfigChanged: function(appConfig, reason, changedData) {
        if (reason === "mapOptionsChange" && changedData && appConfig &&
          changedData.extent) {
          var extent = new Extent(changedData.extent);
          this.homeDijit.set("extent", extent);
        }
      },

      onExtentChange: function() {
        html.removeClass(this.domNode, 'inHome');
      },

      onHome: function(evt) {
        if (!(evt && evt.error)) {
          html.addClass(this.domNode, 'inHome');
        }
      }
    });
    return clazz;
  });