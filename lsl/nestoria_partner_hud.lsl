// ============================================================================
// NESTORIA — Partner HUD (MOAP only)
// ----------------------------------------------------------------------------
// Same web app as the Pregnancy HUD, different page: /partner?token=…
// Touch to pair (first time) or refresh the screen. All support actions
// live on that page — no in-world dialog menu.
//
// SETUP: API_BASE and API_SECRET must match the server .env.
// Face 4 is the media screen (same as the mom HUD). Adjust MOAP_FACE if needed.
// ============================================================================

string  API_BASE   = "https://second-life-maternity-hud-t2b3.onrender.com";
string  API_SECRET = "2175039403870ed15116d0dcf330095af3f6a398e83bca01";

integer MOAP_FACE     = 4;
integer SCREEN_WIDTH  = 1280;
integer SCREEN_HEIGHT = 720;
integer POLL_SECONDS  = 30;

string  gToken = "";
string  gMoapUrl = "";
string  gMomName = "";
key     gHttpReq = NULL_KEY;
key     gPollReq = NULL_KEY;
integer gListenHandle;
integer gMenuChannel;
integer gAwaitingCode = FALSE;

say(string msg) { llOwnerSay("♥ Nestoria Partner: " + msg); }

setMoap(string url)
{
    if (url == "") return;
    integer sides = llGetNumberOfSides();
    if (MOAP_FACE < 0 || MOAP_FACE >= sides)
    {
        say("Face " + (string)MOAP_FACE + " does not exist on this prim.");
        return;
    }
    llClearPrimMedia(MOAP_FACE);
    llSetPrimMediaParams(MOAP_FACE, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_WIDTH_PIXELS, SCREEN_WIDTH,
        PRIM_MEDIA_HEIGHT_PIXELS, SCREEN_HEIGHT
    ]);
}

askForCode()
{
    gAwaitingCode = TRUE;
    gMenuChannel = -1 - (integer)llFrand(1000000.0);
    llListenRemove(gListenHandle);
    gListenHandle = llListen(gMenuChannel, "", llGetOwner(), "");
    llTextBox(llGetOwner(),
        "Enter her pairing code (Partner panel on her Pregnancy HUD).",
        gMenuChannel);
}

default
{
    state_entry()
    {
        say("Touch to pair. After pairing, this screen is the Partner HUD.");
        llSetTimerEvent((float)POLL_SECONDS);
    }

    attach(key id)
    {
        if (id != NULL_KEY && gToken == "") askForCode();
        else if (id != NULL_KEY) setMoap(gMoapUrl);
    }

    touch_start(integer n)
    {
        if (llDetectedKey(0) != llGetOwner()) return;
        if (gToken == "") askForCode();
        else
        {
            setMoap(gMoapUrl);
            say("Partner screen refreshed.");
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        llListenRemove(gListenHandle);
        if (!gAwaitingCode) return;
        gAwaitingCode = FALSE;
        gHttpReq = llHTTPRequest(API_BASE + "/api/sl/partner-link", [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json",
            HTTP_BODY_MAXLENGTH, 16384
        ], llList2Json(JSON_OBJECT, [
            "secret", API_SECRET,
            "code", llStringTrim(message, STRING_TRIM),
            "object_key", (string)llGetKey(),
            "region", llGetRegionName()
        ]));
        say("Pairing...");
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id == gPollReq)
        {
            gPollReq = NULL_KEY;
            if (status == 401) { gToken = ""; return; }
            if (status != 200) return;
            integer i = 0;
            while (llJsonValueType(body, ["commands", i]) != JSON_INVALID)
            {
                string text = llJsonGetValue(body, ["commands", i, "params", "text"]);
                if (text != JSON_INVALID) say(text);
                i++;
            }
            return;
        }
        if (id != gHttpReq) return;
        gHttpReq = NULL_KEY;
        if (status == 401) { gToken = ""; say("Pairing expired — touch to pair again."); return; }
        if (status != 200)
        {
            string err = llJsonGetValue(body, ["error"]);
            if (err == JSON_INVALID) err = "server error " + (string)status;
            say(err);
            return;
        }
        string token = llJsonGetValue(body, ["token"]);
        if (token != JSON_INVALID && token != "") gToken = token;
        string moap = llJsonGetValue(body, ["moap_url"]);
        if (moap != JSON_INVALID && moap != "")
        {
            gMoapUrl = moap;
            setMoap(gMoapUrl);
        }
        string momName = llJsonGetValue(body, ["mom_name"]);
        if (momName != JSON_INVALID) gMomName = momName;
        string msg = llJsonGetValue(body, ["message"]);
        if (msg != JSON_INVALID && msg != "") say(msg);
    }

    timer()
    {
        if (gToken == "") return;
        gPollReq = llHTTPRequest(
            API_BASE + "/api/sl/poll?token=" + gToken + "&kind=partner", [
            HTTP_METHOD, "GET",
            HTTP_BODY_MAXLENGTH, 16384
        ], "");
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
    }

    on_rez(integer start) { }
}
