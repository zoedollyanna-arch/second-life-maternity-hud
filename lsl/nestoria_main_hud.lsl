// NESTORIA - Main HUD network script. Compile with Mono.
// Required alongside nestoria_hud_media.lsl and nestoria_hud_effects.lsl in
// the SAME ROOT PRIM. Keep all props, animations and sounds there too.
// Only this script needs API_BASE and API_SECRET. Screen settings are in media.
// Network responses stay here; helpers receive individual commands only.

string  API_BASE   = "https://second-life-maternity-hud-t2b3.onrender.com";
string  API_SECRET = "2175039403870ed15116d0dcf330095af3f6a398e83bca01";  // same value as SL_API_SECRET in the server .env
integer POLL_SECONDS  = 30;     // fallback poll when push is unavailable
string  gToken       = "";      // session token from /api/sl/register
string  gMoapUrl     = "";
string  gCallbackUrl = "";      // llRequestURL result, pushed to the server
key     gRegisterReq = NULL_KEY;
key     gPollReq     = NULL_KEY;
key     gUrlReq      = NULL_KEY;
key     gActionReq   = NULL_KEY;
key     gPropReq     = NULL_KEY;
key     gPropSender  = NULL_KEY;
string  gPropUse     = "";
float   gPropRequestAt = 0.0;
integer gChairChannel;
integer gChairListen;
float   gPollWait    = 30.0;
integer gFailStreak  = 0;
float   gNextHttp    = 0.0;
string  gCommands   = "";      // only retained while dispatching a received batch

// Root-prim protocol (keep these values identical in all three HUD scripts).
// Commands carry only one params object in str, and the command name in id.
integer LM_COMMAND = 7100;
integer LM_ACTION = 7101;
integer LM_MEDIA_URL = 7102;
integer LM_SYNC = 7103;
integer LM_MEDIA_READY = 7104;

// Private channel shared with the rezzed comfort chair (same formula there).
integer comfortChannel()
{
    return -1 - ((integer)("0x" + llGetSubString((string)llGetOwner(), 0, 6)) & 0x7FFFFFF);
}

say(string msg)
{
    llOwnerSay("♥ Nestoria: " + msg);
}

setMoap(string url)
{
    if (url == "") url = API_BASE + "/";
    gMoapUrl = url;
    llMessageLinked(LINK_THIS, LM_MEDIA_URL, url, NULL_KEY);
}

list httpOpts(string method, integer withJson)
{
    list opts = [
        HTTP_METHOD, method,
        HTTP_BODY_MAXLENGTH, 16384,
        HTTP_VERBOSE_THROTTLE, FALSE,
        HTTP_PRAGMA_NO_CACHE, TRUE
    ];
    if (withJson) opts += [HTTP_MIMETYPE, "application/json"];
    return opts;
}

noteHttpStatus(integer status)
{
    if (status >= 500 || status <= 0)
    {
        ++gFailStreak;
        gPollWait = 90.0 * (float)gFailStreak;
        if (gPollWait > 600.0) gPollWait = 600.0;
        gNextHttp = llGetTime() + gPollWait;
        llSetTimerEvent(gPollWait);
    }
    else if (status == 429)
    {
        gPollWait = 90.0;
        gNextHttp = llGetTime() + gPollWait;
        llSetTimerEvent(gPollWait);
    }
    else
    {
        gFailStreak = 0;
        gPollWait = (float)POLL_SECONDS;
        gNextHttp = 0.0;
        llSetTimerEvent(gPollWait);
    }
}

integer httpIdle()
{
    if (gRegisterReq != NULL_KEY) return FALSE;
    if (gPollReq != NULL_KEY) return FALSE;
    if (llGetTime() < gNextHttp) return FALSE;
    return TRUE;
}

registerWithServer()
{
    if (!httpIdle()) return;
    string body = llList2Json(JSON_OBJECT, [
        "secret", API_SECRET,
        "kind", "hud",
        "callback_url", gCallbackUrl,
        "object_key", (string)llGetKey(),
        "region", llGetRegionName()
    ]);
    gRegisterReq = llHTTPRequest(API_BASE + "/api/sl/register", httpOpts("POST", TRUE), body);
}

pollServer()
{
    if (!httpIdle()) return;
    if (gToken == "") { registerWithServer(); return; }
    gPollReq = llHTTPRequest(
        API_BASE + "/api/sl/poll?token=" + gToken + "&kind=hud",
        httpOpts("GET", FALSE), "");
}

postAction(string action, string params)
{
    if (gToken == "") return;
    if (params == "") params = "{}";
    string body = "{\"token\":\"" + gToken + "\",\"action\":\"" + action + "\",\"params\":" + params + "}";
    gActionReq = llHTTPRequest(API_BASE + "/api/hud/action", httpOpts("POST", TRUE), body);
}

creditProp(key sender, string prop, string useId)
{
    if (gToken == "")
    {
        registerWithServer();
        return;
    }
    if (gPropReq != NULL_KEY && llGetTime() - gPropRequestAt < 45.0) return;
    if (llGetTime() < gNextHttp) return;
    gPropSender = sender;
    gPropUse = useId;
    gPropRequestAt = llGetTime();
    string body = llList2Json(JSON_OBJECT, ["token", gToken,
        "action", "prop_complete", "prop", prop, "use_id", useId]);
    gPropReq = llHTTPRequest(API_BASE + "/api/sl/action", httpOpts("POST", TRUE), body);
}

processCommands()
{
    integer i = 0;
    while (llJsonValueType(gCommands, ["commands", i]) == JSON_OBJECT)
    {
        string cmd = llJsonGetValue(gCommands, ["commands", i, "command"]);
        string params = llJsonGetValue(gCommands, ["commands", i, "params"]);
        if (cmd != JSON_INVALID && cmd != "")
        {
            if (llJsonValueType(params, []) != JSON_OBJECT) params = "{}";
            llMessageLinked(LINK_THIS, LM_COMMAND, params, (key)cmd);
        }
        ++i;
    }
    gCommands = "";
}

requestPushUrl()
{
    llReleaseURL(gCallbackUrl);
    gCallbackUrl = "";
    gUrlReq = llRequestURL();
}

default
{
    state_entry()
    {
        if (llGetInventoryType("nestoria_hud_media") != INVENTORY_SCRIPT
            && llGetInventoryType("nestoria_hud_media.lsl") != INVENTORY_SCRIPT)
            say("Add nestoria_hud_media.lsl to this root prim and compile it with Mono.");
        if (llGetInventoryType("nestoria_hud_effects") != INVENTORY_SCRIPT
            && llGetInventoryType("nestoria_hud_effects.lsl") != INVENTORY_SCRIPT)
            say("Add nestoria_hud_effects.lsl to this root prim and compile it with Mono.");
        gChairChannel = comfortChannel();
        gChairListen = llListen(gChairChannel, "", NULL_KEY, "");
        setMoap(API_BASE + "/");
        requestPushUrl();
        gPollWait = 8.0;
        llSetTimerEvent(gPollWait);
    }

    attach(key id)
    {
        if (id != NULL_KEY) requestPushUrl();
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
        if (change & (CHANGED_REGION | CHANGED_TELEPORT | CHANGED_REGION_START))
            requestPushUrl();
    }

    http_request(key id, string method, string body)
    {
        if (method == URL_REQUEST_GRANTED)
        {
            gCallbackUrl = body;
            registerWithServer();
        }
        else if (method == URL_REQUEST_DENIED)
        {
            gCallbackUrl = "";
            registerWithServer();
        }
        else if (method == "POST")
        {
            // Push from the server: {"secret": "...", "commands":[...]}
            if (llJsonGetValue(body, ["secret"]) == API_SECRET)
            {
                // Release the event's body before calling the dispatcher; the
                // full response is never passed through nested command handlers.
                gCommands = body;
                body = "";
                processCommands();
                llHTTPResponse(id, 200, "ok");
            }
            else llHTTPResponse(id, 403, "forbidden");
        }
        else llHTTPResponse(id, 405, "method not allowed");
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id == gPropReq)
        {
            gPropReq = NULL_KEY;
            if (status == 200 && llJsonGetValue(body, ["ok"]) == JSON_TRUE)
            {
                llRegionSayTo(gPropSender, comfortChannel(), "nestoria_prop_ack|" + gPropUse + "|ok");
                say(llJsonGetValue(body, ["message"]));
            }
            else if (status == 401)
            {
                gToken = "";
                registerWithServer();
            }
            else if (status == 400 || status == 403)
            {
                llRegionSayTo(gPropSender, comfortChannel(), "nestoria_prop_ack|" + gPropUse + "|error");
                string reason = llJsonGetValue(body, ["message"]);
                if (reason == JSON_INVALID || reason == "") reason = "That dose could not be saved.";
                say(reason);
            }
            else noteHttpStatus(status);
        }
        else if (id == gRegisterReq)
        {
            gRegisterReq = NULL_KEY;
            noteHttpStatus(status);
            if (status != 200) return;
            string token = llJsonGetValue(body, ["token"]);
            string moap = llJsonGetValue(body, ["moap_url"]);
            if (token != JSON_INVALID && token != "") gToken = token;
            if (moap != JSON_INVALID && moap != "") setMoap(moap);
            else if (gToken != "") setMoap(API_BASE + "/?token=" + gToken);
        }
        else if (id == gPollReq)
        {
            gPollReq = NULL_KEY;
            noteHttpStatus(status);
            if (status == 401)
            {
                gToken = "";
                return;
            }
            if (status == 200)
            {
                gCommands = body;
                body = "";
                processCommands();
            }
        }
        else if (id == gActionReq)
        {
            gActionReq = NULL_KEY;
            if (status >= 500 || status <= 0 || status == 429) noteHttpStatus(status);
        }
    }

    timer()
    {
        pollServer();
    }

    link_message(integer sender, integer num, string message, key data)
    {
        if (sender != llGetLinkNumber()) return;
        if (num == LM_ACTION) postAction((string)data, message);
        else if (num == LM_SYNC) registerWithServer();
        else if (num == LM_MEDIA_READY) setMoap(gMoapUrl);
    }

    listen(integer channel, string name, key id, string message)
    {
        if (channel == gChairChannel)
        {
            // Only trust objects we own (the comfort chair & worn props)
            if (llGetOwnerKey(id) != llGetOwner()) return;

            if (message == "nestoria_comfort_done")
            {
                postAction("comfort_complete", "{}");
            }
            else if (message == "nestoria_bag_done")
            {
                postAction("pack_bag_complete", "{}");
            }
            else if (message == "nestoria_bed_seated")
            {
                say("You're on the hospital bed. Partner can stay close.");
            }
            else if (message == "nestoria_bed_birth")
            {
                say("The bed is with you for the birth.");
            }
            else if (llSubStringIndex(message, "nestoria_prop_done|") == 0)
            {
                list parts = llParseStringKeepNulls(message, ["|"], []);
                string propAction = llList2String(parts, 1);
                string propParam = llList2String(parts, 2);
                // "nestoria_prop_done|<water|prenatals>|<use id>" — one credit, retried safely.
                if ((propAction == "water" || propAction == "prenatals"
                    || propAction == "chocolate_fruit_toast" || propAction == "smoothie"
                    || propAction == "chocolate_bar" || propAction == "salmon_bagel")
                    && llStringLength(propParam) == 36)
                {
                    creditProp(id, propAction, propParam);
                }
                // Older water and vitamin props must not award stats by name.
                else if (propAction == "drink_water" || propAction == "vitamins")
                {
                    say("Update this prop with the current script, then take it again. Nothing was added to her stats.");
                }
                else if (propAction == "food_eat" || propAction == "eat" || propAction == "snack")
                {
                    string propParams = "{}";
                    if (propParam != "")
                        propParams = llList2Json(JSON_OBJECT, ["food", propParam]);
                    postAction(propAction, propParams);
                }
            }
            return;
        }

    }

    on_rez(integer start)
    {
        llResetScript();
    }
}
