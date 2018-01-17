/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * Copyright (c) 2016-present, Ali Najafizadeh
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule WebViewBridge
 */
'use strict';

var React = require('react');
var ReactNative = require('react-native');
var invariant = require('invariant');
var keyMirror = require('keymirror');
var resolveAssetSource = require('react-native/Libraries/Image/resolveAssetSource');

var {
  ReactNativeViewAttributes,
  UIManager,
  EdgeInsetsPropType,
  StyleSheet,
  Text,
  View,
  WebView,
  requireNativeComponent,
  DeviceEventEmitter,
} = ReactNative;
var { PropTypes } = require('prop-types');
var rnUuid = require('react-native-uuid');
var createReactClass = require('create-react-class');

var RCT_WEBVIEWBRIDGE_REF = 'webviewbridge';

var WebViewBridgeState = keyMirror({
  IDLE: null,
  LOADING: null,
  ERROR: null,
});

var RCTWebViewBridge = requireNativeComponent('RCTWebViewBridge', WebViewBridge);

/**
 * Renders a native WebView.
 */
var WebViewBridge = createReactClass({

  propTypes: {
    ...RCTWebViewBridge.propTypes,

    /**
     * Will be called once the message is being sent from webview
     */
    onBridgeMessage: PropTypes.func,
  },

  getInitialState: function() {
    return {
      viewState: WebViewBridgeState.IDLE,
      lastErrorEvent: null,
      startInLoadingState: true,
    };
  },


  componentWillMount: function() {

    this.uuid = rnUuid.v4();

    this.wvbeListener = DeviceEventEmitter.addListener("WebViewBridgeMessageEvent", (body) => {
      const { onBridgeMessage } = this.props;
      if (body.uuid != this.uuid) { return; }
      const message = body.message;
      if (onBridgeMessage) {
        onBridgeMessage(message);
      }
    });

    this.elementHtmlListener = DeviceEventEmitter.addListener("GetElementHTMLEvent", (event) => {
        if (event.uuid != this.uuid) { return; }
        this.onReceiveElementHTML(event)
    })

    if (this.props.startInLoadingState) {
      this.setState({viewState: WebViewBridgeState.LOADING});
    }
  },

  componentWillUnmount() {
    if (this.wvbeListener != null) this.wvbeListener.remove();
    if (this.elementHtmlListener != null) this.elementHtmlListener.remove();
  },

  render: function() {
    var otherView = null;

   if (this.state.viewState === WebViewBridgeState.LOADING) {
      otherView = this.props.renderLoading && this.props.renderLoading();
    } else if (this.state.viewState === WebViewBridgeState.ERROR) {
      var errorEvent = this.state.lastErrorEvent;
      otherView = this.props.renderError && this.props.renderError(
        errorEvent.domain,
        errorEvent.code,
        errorEvent.description);
    } else if (this.state.viewState !== WebViewBridgeState.IDLE) {
      console.error('RCTWebViewBridge invalid state encountered: ' + this.state.loading);
    }

    var webViewStyles = [styles.container, this.props.style];
    if (this.state.viewState === WebViewBridgeState.LOADING ||
      this.state.viewState === WebViewBridgeState.ERROR) {
      // if we're in either LOADING or ERROR states, don't show the webView
      webViewStyles.push(styles.hidden);
    }

    var {javaScriptEnabled, domStorageEnabled} = this.props;
    if (this.props.javaScriptEnabledAndroid) {
      console.warn('javaScriptEnabledAndroid is deprecated. Use javaScriptEnabled instead');
      javaScriptEnabled = this.props.javaScriptEnabledAndroid;
    }
    if (this.props.domStorageEnabledAndroid) {
      console.warn('domStorageEnabledAndroid is deprecated. Use domStorageEnabled instead');
      domStorageEnabled = this.props.domStorageEnabledAndroid;
    }

    let {source, ...props} = {...this.props};

    var webView =
      <RCTWebViewBridge
        ref={RCT_WEBVIEWBRIDGE_REF}
        key="webViewKey"
 				javaScriptEnabled={true}
        {...props}
        uuid={this.uuid}
        source={resolveAssetSource(source)}
        style={webViewStyles}
        onLoadingStart={this.onLoadingStart}
        onLoadingFinish={this.onLoadingFinish}
        onLoadingError={this.onLoadingError}
        onChange={this.onMessage}
      />;

    return (
      <View style={styles.container}>
        {webView}
        {otherView}
      </View>
    );
  },

  onMessage(event) {
    if (this.props.onBridgeMessage != null && event.nativeEvent != null) {
      this.props.onBridgeMessage(event.nativeEvent.message)
    }
  },

  goForward: function() {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewBridgeHandle(),
      UIManager.RCTWebViewBridge.Commands.goForward,
      null
    );
  },

  goBack: function() {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewBridgeHandle(),
      UIManager.RCTWebViewBridge.Commands.goBack,
      null
    );
  },

  reload: function() {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewBridgeHandle(),
      UIManager.RCTWebViewBridge.Commands.reload,
      null
    );
  },

  sendToBridge: function (message: string, isJSCode: string) {

    if (isJSCode === "true") {
      // alert('Implement RN WebView Bridge sendToBridge for Android!');
      // console.log("Implement RN WebView Bridge sendToBridge for Android!", {message ,isJSCode});
      UIManager.dispatchViewManagerCommand(
        this.getWebViewBridgeHandle(),
        UIManager.RCTWebViewBridge.Commands.sendToBridge,
        [message, true]
      );
    }
    else {

      UIManager.dispatchViewManagerCommand(
        this.getWebViewBridgeHandle(),
        UIManager.RCTWebViewBridge.Commands.sendToBridge,
        [message, false]
      );
    }
  },

  /**
   * We return an event with a bunch of fields including:
   *  url, title, loading, canGoBack, canGoForward
   */
  updateNavigationState: function(event) {
    if (this.props.onNavigationStateChange) {
      this.props.onNavigationStateChange(event.nativeEvent);
    }
  },

  getWebViewBridgeHandle: function() {
    return ReactNative.findNodeHandle(this.refs[RCT_WEBVIEWBRIDGE_REF]);
  },

  onLoadingStart: function(event) {
    var onLoadStart = this.props.onLoadStart;
    onLoadStart && onLoadStart(event);
    this.updateNavigationState(event);
    this.injectWebViewBridge();
  },

  onLoadingError: function(event) {
    event.persist(); // persist this event because we need to store it
    var {onError, onLoadEnd} = this.props;
    onError && onError(event);
    onLoadEnd && onLoadEnd(event);

    this.setState({
      lastErrorEvent: event.nativeEvent,
      viewState: WebViewBridgeState.ERROR
    });
  },

  onLoadingFinish: function(event) {
    var {onLoad, onLoadEnd} = this.props;
    onLoad && onLoad(event);
    onLoadEnd && onLoadEnd(event);
    this.setState({
      viewState: WebViewBridgeState.IDLE,
    });
    this.updateNavigationState(event);
  },

  stopLoading: function(event) {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewBridgeHandle(),
      UIManager.RCTWebViewBridge.Commands.stopLoading,
      [],
    );
  },

  injectWebViewBridge: function() {
    UIManager.dispatchViewManagerCommand(
      this.getWebViewBridgeHandle(),
      UIManager.RCTWebViewBridge.Commands.injectWebViewBridge,
      [],
    );
  },

  _elementCallbacks: {},

  getElementHTML: function(elementID, callback) {
    var innerCallback = (strng) => {
        if (typeof callback === 'function') {
            callback(null, strng);
        }
    }

    if (this._elementCallbacks[elementID] == null) {
        this._elementCallbacks[elementID] = [];
    }

    this._elementCallbacks[elementID].push(innerCallback);

    UIManager.dispatchViewManagerCommand(
      this.getWebViewBridgeHandle(),
      UIManager.RCTWebViewBridge.Commands.getElementHTML,
      [
          elementID,
          innerCallback,
      ],
    );

  },

  onReceiveElementHTML: function(event) {
      const value = event.value;
      const elementID = event.elementID;

      var fns = [...this._elementCallbacks[elementID]];
      if (fns != null) {
          fns.map((callback) => {
              if (typeof callback === 'function') {
                  const deJSON = JSON.parse(value);
                  callback(deJSON);
              }

              removeArrayElement(this._elementCallbacks[elementID], callback);
          })
      }
  },
});

var removeArrayElement = (arr, obj) => {
    const index = arr.indexOf(obj);
    if (index > -1) {
        return arr.splice(index, 1);
    }
    return arr;
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hidden: {
    height: 0,
    flex: 0, // disable 'flex:1' when hiding a View
  },
});

module.exports = WebViewBridge;
