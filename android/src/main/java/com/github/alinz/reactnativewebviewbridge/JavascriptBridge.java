package com.github.alinz.reactnativewebviewbridge;

import android.support.annotation.Nullable;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.uimanager.events.RCTEventEmitter;

class JavascriptBridge {
    private WebView webView;

    protected @Nullable String _uuid;

    public JavascriptBridge(WebView webView, String uuid) {
        this.webView = webView;
        this._uuid = uuid;
    }

    @JavascriptInterface
    public void nativeAndroidSend(String message) {
        WritableMap event = Arguments.createMap();
        event.putString("message", message);
        event.putString("uuid", _uuid);
        ReactContext reactContext = (ReactContext) this.webView.getContext();
        reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("WebViewBridgeMessageEvent", event);

    }

    public void setUuid(@Nullable String uuid) {
        _uuid = uuid;
    }
}
