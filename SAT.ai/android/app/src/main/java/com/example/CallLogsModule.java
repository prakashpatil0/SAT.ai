package com.example;

import android.database.Cursor;
import android.provider.CallLog;
import android.provider.ContactsContract;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

public class CallLogsModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public CallLogsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "CallLogsModule";
    }

    @ReactMethod
    public void getCallLogs(Promise promise) {
        try {
            WritableArray callLogs = Arguments.createArray();
            String[] projection = new String[]{
                    CallLog.Calls._ID,
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.CACHED_NAME,
                    CallLog.Calls.CACHED_NUMBER_TYPE,
                    CallLog.Calls.CACHED_NUMBER_LABEL
            };

            Cursor cursor = reactContext.getContentResolver().query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    null,
                    null,
                    CallLog.Calls.DATE + " DESC"
            );

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap callLog = Arguments.createMap();
                    
                    String phoneNumber = cursor.getString(cursor.getColumnIndex(CallLog.Calls.NUMBER));
                    String cachedName = cursor.getString(cursor.getColumnIndex(CallLog.Calls.CACHED_NAME));
                    int callType = cursor.getInt(cursor.getColumnIndex(CallLog.Calls.TYPE));
                    long timestamp = cursor.getLong(cursor.getColumnIndex(CallLog.Calls.DATE));
                    long duration = cursor.getLong(cursor.getColumnIndex(CallLog.Calls.DURATION));
                    String id = cursor.getString(cursor.getColumnIndex(CallLog.Calls._ID));

                    String callTypeString;
                    switch (callType) {
                        case CallLog.Calls.INCOMING_TYPE:
                            callTypeString = "INCOMING";
                            break;
                        case CallLog.Calls.OUTGOING_TYPE:
                            callTypeString = "OUTGOING";
                            break;
                        case CallLog.Calls.MISSED_TYPE:
                            callTypeString = "MISSED";
                            break;
                        case CallLog.Calls.REJECTED_TYPE:
                            callTypeString = "REJECTED";
                            break;
                        default:
                            callTypeString = "UNKNOWN";
                    }

                    callLog.putString("id", id);
                    callLog.putString("phoneNumber", phoneNumber);
                    callLog.putString("name", cachedName);
                    callLog.putString("type", callTypeString);
                    callLog.putDouble("timestamp", (double) timestamp);
                    callLog.putInt("duration", (int) duration);
                    
                    callLogs.pushMap(callLog);
                }
                cursor.close();
            }
            promise.resolve(callLogs);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
} 