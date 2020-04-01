package com.github.alinz.reactnativewebviewbridge;

import android.content.Context;
import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.WebView;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.uimanager.ThemedReactContext;
//import com.facebook.react.views.webview.ReactWebViewManager;
import com.facebook.react.uimanager.annotations.ReactProp;

import org.apache.commons.text.StringEscapeUtils;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.WeakHashMap;

import javax.annotation.Nullable;

//public class WebViewBridgeManager extends ReactWebViewManager {
public class WebViewBridgeManager extends RNCWebViewManager {
    private static final String REACT_CLASS = "RCTWebViewBridge";

    public static final int COMMAND_INJECT_WEBVIEW_BRIDGE = 101;
    public static final int COMMAND_INJECT_RPC = 102;
    public static final int COMMAND_SEND_TO_BRIDGE = 103;
    public static final int COMMAND_GET_ELEMENT_HTML = 104;

    public static String TAG = REACT_CLASS;

    private ReactApplicationContext reactApplicationContext;

    private WeakHashMap<WebView, String> _uuidMap;
    private WeakHashMap<WebView, JavascriptBridge> _bridgeMap;

    public WebViewBridgeManager(ReactApplicationContext reactApplicationContext) {
        super();
        //we need to know the context because we need to load files from asset
        this.reactApplicationContext = reactApplicationContext;
        _uuidMap = new WeakHashMap<>();
        _bridgeMap = new WeakHashMap<>();
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    public
    @Nullable
    Map<String, Integer> getCommandsMap() {
        Map<String, Integer> commandsMap = super.getCommandsMap();

        commandsMap.put("sendToBridge", COMMAND_SEND_TO_BRIDGE);
        commandsMap.put("injectWebViewBridge", COMMAND_INJECT_WEBVIEW_BRIDGE);
        commandsMap.put("injectRPC", COMMAND_INJECT_RPC);
        commandsMap.put("getElementHTML", COMMAND_GET_ELEMENT_HTML);

        return commandsMap;
    }

    @Override
    protected WebView createViewInstance(ThemedReactContext reactContext) {
        WebView root = super.createViewInstance(reactContext);
        JavascriptBridge bridge = new JavascriptBridge(root);
        root.addJavascriptInterface(bridge, "WebViewBridgeAndroid");
        _bridgeMap.put(root, bridge);
        return root;
    }

    @Override
    public void receiveCommand(WebView root, int commandId, @Nullable ReadableArray args) {
        super.receiveCommand(root, commandId, args);

        switch (commandId) {
            case COMMAND_SEND_TO_BRIDGE:
                sendToBridge(root, args.getString(0), args.getBoolean(1));
                break;
            case COMMAND_INJECT_WEBVIEW_BRIDGE:
                injectWebViewBridgeScript(root);
                break;
            case COMMAND_INJECT_RPC:
                injectWebViewBridgeRPCScript(root);
                break;
            case COMMAND_GET_ELEMENT_HTML:
                getElementHTML(root, args.getString(0));
                break;
            default:
                //do nothing!!!!
        }
    }

    private static String inputStreamToString(InputStream input) throws IOException {
        StringBuilder builder = new StringBuilder();
        int ch;
        while((ch = input.read()) != -1){
            builder.append((char)ch);
        }
        input.close();
        return builder.toString();
    }

    private static String loadAsset(String filename, final Context context) {
        String output = null;

        try {
            InputStream inputStream = context.getAssets().open(filename);
            output = inputStreamToString(inputStream);
        } catch (IOException e) {
            e.printStackTrace();
        }

        return output;
    }

    private void injectWebViewBridgeScript(WebView root) {
        String injectContent = loadAsset("WebViewBridge.js", this.reactApplicationContext);
        if (injectContent != null) {
            evaluateJavascript(root, injectContent);
        }
    }

    private void injectWebViewBridgeRPCScript(WebView root) {
        String injectContent = loadAsset("WebViewBridgeRPC.js", this.reactApplicationContext);
        if (injectContent != null) {
            evaluateJavascript(root, injectContent);
        }
    }

    private void sendToBridge(WebView root, String message, boolean isJSCode) {
        // need to escape this for JavaScript to be able to process correctly...
        String script = "";
        if (!isJSCode) {
            String escapedMessage = StringEscapeUtils.escapeEcmaScript(message);
            script = "(function(){ if (WebViewBridge && WebViewBridge.__push__) { WebViewBridge.__push__(\"" + escapedMessage + "\"); } }());";
        }
        else {
            script = "(function(){ " + message + " }());";
        }
        WebViewBridgeManager.evaluateJavascript(root, script);
    }


    private void getElementHTML(final WebView root, final @Nullable String elementID) {

        String javascript = String.format("document.getElementById(\"%s\").innerHTML", elementID);

        root.evaluateJavascript(javascript, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {

                String uuid = _uuidMap.get(root);

                WritableMap event = Arguments.createMap();
                event.putString("value", value);
                event.putString("elementID", elementID);
                event.putString("uuid", uuid);
                ReactContext reactContext = (ReactContext) root.getContext();
                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("GetElementHTMLEvent", event);
            }
        });
    }

    static private void evaluateJavascript(WebView root, String javascript) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            root.evaluateJavascript(javascript, null);
        } else {
            root.loadUrl("javascript:" + javascript);
        }
    }
    
    @ReactProp(name = "injectedJavaScript")
    public void setInjectedJavaScript(WebView root, @Nullable String injectedJavaScript) {
        evaluateJavascript(root, injectedJavaScript);
    }

    @ReactProp(name = "requestFocus")
    public void requestFocus(WebView root, boolean isRequestFocus) {
        if(isRequestFocus) {
            root.requestFocus();
        }
    }

    @ReactProp(name = "allowFileAccessFromFileURLs")
    public void setAllowFileAccessFromFileURLs(WebView root, boolean allows) {
        root.getSettings().setAllowFileAccessFromFileURLs(allows);
    }

    @ReactProp(name = "allowUniversalAccessFromFileURLs")
    public void setAllowUniversalAccessFromFileURLs(WebView root, boolean allows) {
        root.getSettings().setAllowUniversalAccessFromFileURLs(allows);
    }

    @ReactProp(name = "uuid")
    public void setUuid(WebView root, @Nullable String uuid) {
        _uuidMap.put(root, uuid);
        JavascriptBridge bridge = _bridgeMap.get(root);
        if (bridge != null) {
            bridge.setUuid(uuid);
        }
    }
}
