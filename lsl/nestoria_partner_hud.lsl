// ============================================================================
// NESTORIA — Partner HUD (MOAP only)
// ----------------------------------------------------------------------------
// Same web app as the Pregnancy HUD, different page: /partner?token=…
// Touch to pair (first time) or refresh the screen. All support actions
// live on that page — no in-world dialog menu.
//
// SETUP: API_BASE and API_SECRET must match the server .env.
// Face 4 of link 2 is the media screen. Script goes in the ROOT prim.
// ============================================================================

string  API_BASE   = "https://second-life-maternity-hud-t2b3.onrender.com";
string  API_SECRET = "2175039403870ed15116d0dcf330095af3f6a398e83bca01";

integer MOAP_LINK     = 2;
integer MOAP_FACE     = 4;
integer SCREEN_WIDTH  = 1024;
integer SCREEN_HEIGHT = 824;
integer POLL_SECONDS  = 30;

string  gToken = "";
string  gMoapUrl = "";
string  gMomName = "";
key     gHttpReq = NULL_KEY;
key     gPollReq = NULL_KEY;
integer gListenHandle;
integer gMenuChannel;
integer gAwaitingCode = FALSE;
float   gPollWait = 30.0;
integer gFailStreak = 0;
float   gNextHttp = 0.0;
integer gMediaReady = FALSE;

say(string msg) { llOwnerSay("♥ Nestoria Partner: " + msg); }

// Optional flourish — a missing animation or particle texture is skipped, never
// an error, so the HUD works with nothing but the script inside it.
heartsBurst()
{
    llParticleSystem([
        PSYS_PART_FLAGS, PSYS_PART_EMISSIVE_MASK | PSYS_PART_INTERP_COLOR_MASK,
        PSYS_SRC_PATTERN, PSYS_SRC_PATTERN_EXPLODE,
        PSYS_PART_START_COLOR, <1.0, 0.72, 0.84>,
        PSYS_PART_END_ALPHA, 0.0,
        PSYS_PART_START_SCALE, <0.14, 0.14, 0.0>,
        PSYS_PART_MAX_AGE, 1.6,
        PSYS_SRC_BURST_RATE, 0.02,
        PSYS_SRC_BURST_PART_COUNT, 12,
        PSYS_SRC_BURST_RADIUS, 0.2,
        PSYS_SRC_BURST_SPEED_MIN, 0.2,
        PSYS_SRC_BURST_SPEED_MAX, 0.5,
        PSYS_SRC_MAX_AGE, 2.0
    ]);
    llSetTimerEvent(2.5);
}

// Roleplay reactions the wearer opted into on the More → My reactions screen.
// They never touch her labor — the server has already decided everything.
reactAnim(string anim, string line)
{
    say(line);
    if (llGetInventoryType(anim) == INVENTORY_ANIMATION)
    {
        if (llGetPermissions() & PERMISSION_TRIGGER_ANIMATION) llStartAnimation(anim);
        else llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION);
    }
}

integer hudPrimCount()
{
    integer n = llList2Integer(llGetObjectDetails(llGetKey(), [OBJECT_PRIM_COUNT]), 0);
    if (n < 1) n = MOAP_LINK;
    if (llGetLinkNumber() == 0) n = 1;
    return n;
}

integer moapLink()
{
    if (llGetLinkNumber() == 0) return LINK_THIS;
    integer me = llGetLinkNumber();
    if (me == MOAP_LINK) return LINK_THIS;
    integer n = hudPrimCount();
    if (MOAP_LINK >= 1 && MOAP_LINK <= n) return MOAP_LINK;
    return LINK_THIS;
}

integer moapFace(integer link)
{
    integer sides = llGetLinkNumberOfSides(link);
    if (MOAP_FACE >= 0 && MOAP_FACE < sides) return MOAP_FACE;
    return 0;
}

prepMoapFace(integer link, integer face)
{
    llSetLinkPrimitiveParamsFast(link, [
        PRIM_COLOR, face, <1.0, 1.0, 1.0>, 1.0,
        PRIM_FULLBRIGHT, face, TRUE,
        PRIM_GLOW, face, 0.0,
        PRIM_TEXTURE, face, TEXTURE_BLANK, <1.0, 1.0, 0.0>, ZERO_VECTOR, 0.0
    ]);
}

integer applyMoap(integer link, integer face, string url, string home)
{
    prepMoapFace(link, face);
    return llSetLinkMedia(link, face, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, home,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, FALSE,
        PRIM_MEDIA_AUTO_LOOP, FALSE,
        PRIM_MEDIA_AUTO_ZOOM, FALSE,
        PRIM_MEDIA_FIRST_CLICK_INTERACT, TRUE,
        PRIM_MEDIA_WHITELIST_ENABLE, FALSE,
        PRIM_MEDIA_WHITELIST, "",
        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_ANYONE,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_WIDTH_PIXELS, SCREEN_WIDTH,
        PRIM_MEDIA_HEIGHT_PIXELS, SCREEN_HEIGHT
    ]);
}

setMoap(string url)
{
    if (url == "") url = API_BASE + "/partner";
    gMoapUrl = url;

    string nav = url;
    if (llSubStringIndex(nav, "#") == -1) nav += "#n" + (string)llGetUnixTime();

    integer link = moapLink();
    integer face = moapFace(link);

    if (!gMediaReady)
    {
        integer f;
        integer sides = llGetLinkNumberOfSides(link);
        for (f = 0; f < sides; ++f)
        {
            if (f != face) llClearLinkMedia(link, f);
        }
        gMediaReady = TRUE;
    }

    integer status = applyMoap(link, face, nav, url);
    if (status != STATUS_OK && link != LINK_THIS)
        status = applyMoap(LINK_THIS, face, nav, url);
    if (status != STATUS_OK && face != 0)
        status = applyMoap(link, 0, nav, url);
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
    if (gHttpReq != NULL_KEY) return FALSE;
    if (gPollReq != NULL_KEY) return FALSE;
    if (llGetTime() < gNextHttp) return FALSE;
    return TRUE;
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
        setMoap(API_BASE + "/partner");
        say("Touch to pair. After pairing, this screen is the Partner HUD.");
        gPollWait = 8.0;
        llSetTimerEvent(gPollWait);
    }

    attach(key id)
    {
        if (id == NULL_KEY) return;
        gMediaReady = FALSE;
        if (gMoapUrl == "") setMoap(API_BASE + "/partner");
        else setMoap(gMoapUrl);
        if (gToken == "") askForCode();
    }

    touch_start(integer n)
    {
        if (llDetectedKey(0) != llGetOwner()) return;
        if (gMoapUrl == "") setMoap(API_BASE + "/partner");
        else setMoap(gMoapUrl);
        if (gToken == "") askForCode();
    }

    listen(integer channel, string name, key id, string message)
    {
        llListenRemove(gListenHandle);
        if (!gAwaitingCode) return;
        gAwaitingCode = FALSE;
        if (!httpIdle())
        {
            say("Give it a minute — the server is catching up — then touch again.");
            return;
        }
        gHttpReq = llHTTPRequest(API_BASE + "/api/sl/partner-link", httpOpts("POST", TRUE),
            llList2Json(JSON_OBJECT, [
                "secret", API_SECRET,
                "code", llStringTrim(message, STRING_TRIM),
                "object_key", (string)llGetKey(),
                "region", llGetRegionName()
            ]));
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id == gPollReq)
        {
            gPollReq = NULL_KEY;
            noteHttpStatus(status);
            if (status == 401) { gToken = ""; return; }
            if (status != 200) return;
            integer i = 0;
            while (llJsonValueType(body, ["commands", i]) != JSON_INVALID)
            {
                string cmd  = llJsonGetValue(body, ["commands", i, "command"]);
                string text = llJsonGetValue(body, ["commands", i, "params", "text"]);
                if (text != JSON_INVALID && text != "") say(text);
                if (cmd == "hearts")      heartsBurst();
                else if (cmd == "faint")  reactAnim("nestoria_faint", "The room tilts. You sit down hard.");
                else if (cmd == "vomit")  reactAnim("nestoria_vomit", "Your stomach turns.");
                i++;
            }
            return;
        }
        if (id != gHttpReq) return;
        gHttpReq = NULL_KEY;
        noteHttpStatus(status);
        if (status == 401) { gToken = ""; return; }
        if (status != 200) return;
        string token = llJsonGetValue(body, ["token"]);
        if (token != JSON_INVALID && token != "") gToken = token;
        string moap = llJsonGetValue(body, ["moap_url"]);
        if (moap != JSON_INVALID && moap != "") setMoap(moap);
        else if (gToken != "") setMoap(API_BASE + "/partner?token=" + gToken);
        string momName = llJsonGetValue(body, ["mom_name"]);
        if (momName != JSON_INVALID) gMomName = momName;
        string msg = llJsonGetValue(body, ["message"]);
        if (msg != JSON_INVALID && msg != "") say(msg);
    }

    timer()
    {
        if (gToken == "") return;
        if (!httpIdle()) return;
        gPollReq = llHTTPRequest(
            API_BASE + "/api/sl/poll?token=" + gToken + "&kind=partner",
            httpOpts("GET", FALSE), "");
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
        if (change & (CHANGED_REGION | CHANGED_TELEPORT | CHANGED_REGION_START))
        {
            gMediaReady = FALSE;
            if (gMoapUrl != "") setMoap(gMoapUrl);
        }
    }

    run_time_permissions(integer perms)
    {
        if (perms & PERMISSION_TRIGGER_ANIMATION) llOwnerSay("Reactions enabled.");
    }

    on_rez(integer start) { }
}
