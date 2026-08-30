// ============================================================================
// NESTORIA PREGNANCY HUD — Main HUD script
// ----------------------------------------------------------------------------
// Drop this script into the root prim of the HUD object (a flat mesh/prim
// tablet worn as a HUD). The front face displays the Nestoria web dashboard
// via shared media (MOAP).
//
// SETUP (edit these two lines before saving):
//   API_BASE   = your deployed Nestoria server, no trailing slash
//   API_SECRET = must match SL_API_SECRET in the server's .env
//
// Inventory (referenced by name):
//   object "nestoria_chair"     — comfort chair (REQUIRED for the Comfort
//                                 action; contains nestoria_comfort_chair.lsl)
//   object "nestoria_hospital_bed" — optional; rezzed if present when
//                                 she goes to hospital. Worn bag is separate.
//
// Optional inventory — sounds are OPTIONAL because the MOAP dashboard plays
// all system sounds through the media screen itself:
//   sound  "nestoria_chime"     — soft notification chime
//   sound  "nestoria_heartbeat" — baby heartbeat loop sample
//   sound  "nestoria_sip"       — drinking sound
//   anim   "nestoria_drink"      — drink animation
//   anim   "nestoria_rest"       — rest / relax animation
//   anim   "nestoria_vitamins"   — take-pill animation
//   anim   "nestoria_belly_hold" — belly-holding animation
// Missing items are skipped gracefully.
// ============================================================================

string  API_BASE   = "https://second-life-maternity-hud-t2b3.onrender.com";
string  API_SECRET = "2175039403870ed15116d0dcf330095af3f6a398e83bca01";  // same value as SL_API_SECRET in the server .env

integer MOAP_FACE     = 4;      // face that shows the dashboard (adjust to your prim)
integer POLL_SECONDS  = 30;     // fallback poll when push is unavailable
float   VOLUME        = 0.7;

// ---------------------------------------------------------------------------
string  gToken       = "";      // session token from /api/sl/register
string  gMoapUrl     = "";
string  gCallbackUrl = "";      // llRequestURL result, pushed to the server
key     gRegisterReq = NULL_KEY;
key     gPollReq     = NULL_KEY;
key     gUrlReq      = NULL_KEY;
key     gActionReq   = NULL_KEY;
integer gListenHandle;
integer gMenuChannel;
integer gChairChannel;
integer gChairListen;
string  gDialogKind  = "";
string  gDialogEvent = "";

// Private channel shared with the rezzed comfort chair (same formula there).
integer comfortChannel()
{
    return -1 - ((integer)("0x" + llGetSubString((string)llGetOwner(), 0, 6)) & 0x7FFFFFF);
}

say(string msg)
{
    llOwnerSay("♥ Nestoria: " + msg);
}

playSoundByName(string name)
{
    if (llGetInventoryType(name) == INVENTORY_SOUND)
        llPlaySound(name, VOLUME);
}

startAnimByName(string name)
{
    if (llGetInventoryType(name) == INVENTORY_ANIMATION)
    {
        if (llGetPermissions() & PERMISSION_TRIGGER_ANIMATION)
        {
            llStartAnimation(name);
            llSetTimerEvent(0.0);
            // stop after a few seconds via a dedicated short timer is overkill;
            // most action anims are self-limiting loops — stop on next poll.
            llSetTimerEvent((float)POLL_SECONDS);
        }
    }
}

heartsBurst()
{
    llParticleSystem([
        PSYS_PART_FLAGS, PSYS_PART_EMISSIVE_MASK | PSYS_PART_INTERP_COLOR_MASK
                       | PSYS_PART_INTERP_SCALE_MASK | PSYS_PART_FOLLOW_VELOCITY_MASK,
        PSYS_SRC_PATTERN, PSYS_SRC_PATTERN_EXPLODE,
        PSYS_PART_START_COLOR, <1.0, 0.6, 0.8>,
        PSYS_PART_END_COLOR,   <0.85, 0.7, 1.0>,
        PSYS_PART_START_SCALE, <0.15, 0.15, 0.0>,
        PSYS_PART_END_SCALE,   <0.05, 0.05, 0.0>,
        PSYS_PART_MAX_AGE, 2.5,
        PSYS_SRC_BURST_RATE, 0.05,
        PSYS_SRC_BURST_PART_COUNT, 12,
        PSYS_SRC_BURST_SPEED_MIN, 0.2,
        PSYS_SRC_BURST_SPEED_MAX, 0.6,
        PSYS_SRC_MAX_AGE, 1.5,
        PSYS_PART_START_ALPHA, 0.9,
        PSYS_PART_END_ALPHA, 0.0
    ]);
    // No llSleep here. PSYS_SRC_MAX_AGE above already stops the emitter after
    // 1.5s, and llSleep suspends the whole script — including the http_request
    // handler this runs inside, so a pushed batch containing several hearts
    // commands stalled the HUD for seconds at a time and could overflow the
    // event queue. The burst ends itself.
}

// The screen's resolution. The dashboard is authored against exactly this
// width (HUD_DESIGN_WIDTH in src/routes/index.tsx) — keep the two in step or
// the whole page renders permanently scaled down.
integer SCREEN_WIDTH  = 1280;
integer SCREEN_HEIGHT = 720;

setMoap(string url)
{
    if (url == "") return;

    integer sides = llGetNumberOfSides();
    if (MOAP_FACE < 0 || MOAP_FACE >= sides)
    {
        say("Face " + (string)MOAP_FACE + " does not exist on this prim — it has "
            + (string)sides + " face(s), numbered 0-" + (string)(sides - 1)
            + ". Edit MOAP_FACE at the top of this script.");
        return;
    }

    llClearPrimMedia(MOAP_FACE);
    llSetPrimMediaParams(MOAP_FACE, [
        PRIM_MEDIA_CURRENT_URL, url,
        PRIM_MEDIA_HOME_URL, url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,

        // Stretch the media texture across all of face 4. When this is FALSE,
        // Second Life preserves the media texture's native mapping and leaves
        // unused parts of a differently shaped face black. This setting only
        // controls texture-to-face fitting; the dashboard's plus/minus/reset/
        // Fit zoom remains controlled by ScaledFrame in src/routes/index.tsx.
        PRIM_MEDIA_AUTO_SCALE, TRUE,

        PRIM_MEDIA_PERMS_INTERACT, PRIM_MEDIA_PERM_OWNER,
        PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE,
        PRIM_MEDIA_CONTROLS, PRIM_MEDIA_CONTROLS_MINI,
        PRIM_MEDIA_WIDTH_PIXELS, SCREEN_WIDTH,
        PRIM_MEDIA_HEIGHT_PIXELS, SCREEN_HEIGHT
    ]);
}

registerWithServer()
{
    string body = llList2Json(JSON_OBJECT, [
        "secret", API_SECRET,
        "kind", "hud",
        "callback_url", gCallbackUrl,
        "object_key", (string)llGetKey(),
        "region", llGetRegionName()
    ]);
    gRegisterReq = llHTTPRequest(API_BASE + "/api/sl/register", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384
    ], body);
}

pollServer()
{
    // No token means registration never succeeded. Retry it here rather than
    // returning: the timer is the only thing that runs on its own, so bailing
    // out left a HUD whose first register failed dead until somebody touched
    // it — and one cold start on the server is enough to lose that first
    // attempt. nestoria_belly.lsl has always done it this way.
    if (gToken == "") { registerWithServer(); return; }
    gPollReq = llHTTPRequest(
        API_BASE + "/api/sl/poll?token=" + gToken + "&kind=hud", [
        HTTP_METHOD, "GET",
        HTTP_BODY_MAXLENGTH, 16384
    ], "");
}

postAction(string action, string params)
{
    if (gToken == "") return;
    if (params == "") params = "{}";
    string body = "{\"token\":\"" + gToken + "\",\"action\":\"" + action + "\",\"params\":" + params + "}";
    gActionReq = llHTTPRequest(API_BASE + "/api/hud/action", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384
    ], body);
}

rezChair()
{
    if (llGetInventoryType("nestoria_chair") != INVENTORY_OBJECT)
    {
        say("The comfy chair object is missing from the HUD - add \"nestoria_chair\" to its contents.");
        return;
    }
    // A HUD's own pos/rot are screen coordinates — use the avatar's instead.
    list details = llGetObjectDetails(llGetOwner(), [OBJECT_POS, OBJECT_ROT]);
    vector ownerPos = llList2Vector(details, 0);
    rotation ownerRot = llList2Rot(details, 1);
    vector rezPos = ownerPos + <1.2, 0.0, 0.0> * ownerRot;
    llRezObject("nestoria_chair", rezPos, ZERO_VECTOR, ownerRot, 0);
    say("Your comfy chair is out - sit and relax for 2 minutes.");
}

talkWorld(string message)
{
    llRegionSay(comfortChannel(), message);
}

rezBed()
{
    if (llGetInventoryType("nestoria_hospital_bed") == INVENTORY_OBJECT)
    {
        list details = llGetObjectDetails(llGetOwner(), [OBJECT_POS, OBJECT_ROT]);
        vector ownerPos = llList2Vector(details, 0);
        rotation ownerRot = llList2Rot(details, 1);
        vector rezPos = ownerPos + <1.5, 0.0, 0.0> * ownerRot;
        llRezObject("nestoria_hospital_bed", rezPos, ZERO_VECTOR, ownerRot, 1);
        say("Hospital bed is out — sit when you are ready.");
    }
    talkWorld("nestoria_labor_hospital");
}

vomitBurst()
{
    llParticleSystem([
        PSYS_PART_FLAGS, PSYS_PART_EMISSIVE_MASK | PSYS_PART_INTERP_COLOR_MASK
                       | PSYS_PART_INTERP_SCALE_MASK | PSYS_PART_FOLLOW_VELOCITY_MASK,
        PSYS_SRC_PATTERN, PSYS_SRC_PATTERN_ANGLE_CONE,
        PSYS_SRC_ANGLE_BEGIN, 0.0,
        PSYS_SRC_ANGLE_END, 0.35,
        PSYS_PART_START_COLOR, <0.75, 0.85, 0.65>,
        PSYS_PART_END_COLOR,   <0.55, 0.65, 0.45>,
        PSYS_PART_START_SCALE, <0.08, 0.08, 0.0>,
        PSYS_PART_END_SCALE,   <0.03, 0.03, 0.0>,
        PSYS_PART_MAX_AGE, 1.8,
        PSYS_SRC_BURST_RATE, 0.04,
        PSYS_SRC_BURST_PART_COUNT, 8,
        PSYS_SRC_BURST_SPEED_MIN, 0.15,
        PSYS_SRC_BURST_SPEED_MAX, 0.45,
        PSYS_SRC_MAX_AGE, 1.2,
        PSYS_PART_START_ALPHA, 0.7,
        PSYS_PART_END_ALPHA, 0.0
    ]);
}

openEventDialog(string params)
{
    string title = llJsonGetValue(params, ["title"]);
    string body = llJsonGetValue(params, ["body"]);
    gDialogKind = llJsonGetValue(params, ["kind"]);
    gDialogEvent = llJsonGetValue(params, ["eventType"]);
    if (title == JSON_INVALID) title = "Nestoria Event";
    if (body == JSON_INVALID) body = "";
    if (gDialogKind == JSON_INVALID) gDialogKind = "event";
    if (gDialogEvent == JSON_INVALID) gDialogEvent = "";

    gMenuChannel = -1 - (integer)llFrand(1000000.0);
    llListenRemove(gListenHandle);
    gListenHandle = llListen(gMenuChannel, "", llGetOwner(), "");

    if (gDialogKind == "craving")
    {
        llDialog(llGetOwner(),
            title + "\n\n" + body + "\n\n1 Eat craving\n2 Healthy swap\n3 Ask partner\n4 Ignore\n5 Save memory",
            ["1", "2", "3", "4", "5", "Close"], gMenuChannel);
    }
    else
    {
        llDialog(llGetOwner(),
            title + "\n\n" + body + "\n\n1 Rub belly\n2 Count kick\n3 Drink water\n4 Rest\n5 Journal",
            ["1", "2", "3", "4", "5", "Close"], gMenuChannel);
    }
}

runCommand(string cmd, string params)
{
    if (cmd == "say")
    {
        say(llJsonGetValue(params, ["text"]));
    }
    else if (cmd == "chime")
    {
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "hearts")
    {
        heartsBurst();
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "heartbeat")
    {
        playSoundByName("nestoria_heartbeat");
        say(llJsonGetValue(params, ["text"]));
    }
    else if (cmd == "drink")
    {
        playSoundByName("nestoria_sip");
        startAnimByName("nestoria_drink");
    }
    else if (cmd == "rest")
    {
        startAnimByName("nestoria_rest");
    }
    else if (cmd == "vitamins")
    {
        startAnimByName("nestoria_vitamins");
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "belly_hold")
    {
        startAnimByName("nestoria_belly_hold");
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "im")
    {
        string target = llJsonGetValue(params, ["target"]);
        string text = llJsonGetValue(params, ["text"]);
        if (target != JSON_INVALID && text != JSON_INVALID)
            llInstantMessage((key)target, text);
    }
    else if (cmd == "kick")
    {
        say("[Baby] " + llJsonGetValue(params, ["text"]));
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "refresh_moap")
    {
        setMoap(gMoapUrl);
    }
    else if (cmd == "rez_chair")
    {
        rezChair();
    }
    else if (cmd == "bag_pack")
    {
        talkWorld("nestoria_bag_pack");
        say("If the hospital bag is worn, it is opening to pack.");
    }
    else if (cmd == "rez_bed")
    {
        rezBed();
    }
    else if (cmd == "labor_water")
    {
        talkWorld("nestoria_labor_water");
        say("Your water has broken.");
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "labor_contractions")
    {
        talkWorld("nestoria_labor_contractions");
        startAnimByName("nestoria_rest");
        say("A contraction. Breathe.");
        playSoundByName("nestoria_heartbeat");
    }
    else if (cmd == "labor_birth")
    {
        talkWorld("nestoria_labor_birth");
        heartsBurst();
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "sleep")
    {
        startAnimByName("nestoria_rest");
        say("You settle in to sleep.");
    }
    else if (cmd == "vomit")
    {
        vomitBurst();
        startAnimByName("nestoria_rest");
        say("A wave of sickness hits.");
    }
    else if (cmd == "cry")
    {
        say("Tears come. That's alright.");
    }
    else if (cmd == "bathroom")
    {
        if (llGetInventoryType("nestoria_toilet") == INVENTORY_OBJECT)
        {
            list details = llGetObjectDetails(llGetOwner(), [OBJECT_POS, OBJECT_ROT]);
            vector ownerPos = llList2Vector(details, 0);
            rotation ownerRot = llList2Rot(details, 1);
            llRezObject("nestoria_toilet", ownerPos + <1.0, 0.4, 0.0> * ownerRot,
                ZERO_VECTOR, ownerRot, 1);
        }
        talkWorld("nestoria_bathroom");
        say("Bathroom break.");
    }
    else if (cmd == "water_break")
    {
        talkWorld("nestoria_labor_water");
        say("Your water has broken.");
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "contractions")
    {
        talkWorld("nestoria_labor_contractions");
        startAnimByName("nestoria_rest");
        say("A contraction. Breathe.");
        playSoundByName("nestoria_heartbeat");
    }
    else if (cmd == "birth")
    {
        talkWorld("nestoria_labor_birth");
        heartsBurst();
        playSoundByName("nestoria_chime");
    }
    else if (cmd == "dialog")
    {
        openEventDialog(params);
    }
}

processCommands(string json)
{
    integer i = 0;
    while (llJsonValueType(json, ["commands", i]) != JSON_INVALID)
    {
        string cmd = llJsonGetValue(json, ["commands", i, "command"]);
        string params = llJsonGetValue(json, ["commands", i, "params"]);
        runCommand(cmd, params);
        i++;
    }
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
        llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION);
        gChairChannel = comfortChannel();
        gChairListen = llListen(gChairChannel, "", NULL_KEY, "");
        requestPushUrl();
        // Safety net: every retry path lives in the timer, but until now the
        // timer was only ever started from an http_response. If llRequestURL
        // never came back, nothing retried and the HUD stayed blank forever.
        // pollServer() re-registers on its own when there is no token yet.
        llSetTimerEvent((float)POLL_SECONDS);
    }

    attach(key id)
    {
        if (id != NULL_KEY)
        {
            llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION);
            requestPushUrl();
        }
    }

    changed(integer change)
    {
        if (change & (CHANGED_REGION | CHANGED_TELEPORT | CHANGED_REGION_START))
        {
            // http-in URLs die on region change — get a new one and re-register
            requestPushUrl();
        }
        if (change & CHANGED_OWNER) llResetScript();
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
            say("No free URLs on this parcel - using polling only.");
            registerWithServer();
        }
        else if (method == "POST")
        {
            // Push from the server: {"secret": "...", "commands":[...]}
            if (llJsonGetValue(body, ["secret"]) == API_SECRET)
            {
                processCommands(body);
                llHTTPResponse(id, 200, "ok");
            }
            else llHTTPResponse(id, 403, "forbidden");
        }
        else llHTTPResponse(id, 405, "method not allowed");
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (id == gRegisterReq)
        {
            gRegisterReq = NULL_KEY;
            if (status != 200)
            {
                llSetTimerEvent(60.0);
                return;
            }
            gToken   = llJsonGetValue(body, ["token"]);
            gMoapUrl = llJsonGetValue(body, ["moap_url"]);
            string welcome = llJsonGetValue(body, ["welcome"]);
            setMoap(gMoapUrl);
            if (welcome != JSON_INVALID) say(welcome);
            llSetTimerEvent((float)POLL_SECONDS);
        }
        else if (id == gPollReq)
        {
            gPollReq = NULL_KEY;
            if (status == 401)
            {
                // session expired — re-register
                registerWithServer();
                return;
            }
            if (status == 200) processCommands(body);
        }
    }

    timer()
    {
        pollServer();
    }

    touch_start(integer n)
    {
        if (llDetectedKey(0) != llGetOwner()) return;

        setMoap(gMoapUrl);
        registerWithServer();
        llSetTimerEvent((float)POLL_SECONDS);
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
                // "nestoria_prop_done|<action>|<param>|<Display Name>"
                list parts = llParseStringKeepNulls(message, ["|"], []);
                string propAction = llList2String(parts, 1);
                string propParam = llList2String(parts, 2);
                // props may only trigger these gentle self-care actions
                if (propAction == "food_eat" || propAction == "drink_water"
                    || propAction == "vitamins" || propAction == "eat" || propAction == "snack")
                {
                    string propParams = "{}";
                    if (propParam != "")
                        propParams = llList2Json(JSON_OBJECT, ["food", propParam]);
                    postAction(propAction, propParams);
                }
            }
            return;
        }

        llListenRemove(gListenHandle);
        if (message == "Close")
        {
            gDialogKind = "";
            gDialogEvent = "";
            return;
        }

        if (gDialogKind == "craving")
        {
            string choice = "";
            if (message == "1") choice = "eat";
            else if (message == "2") choice = "healthy";
            else if (message == "3") choice = "ask_partner";
            else if (message == "4") choice = "ignore";
            else if (message == "5") choice = "journal";
            if (choice != "")
                postAction("craving_choice", llList2Json(JSON_OBJECT, ["choice", choice]));
        }
        else if (gDialogKind == "event")
        {
            string choice = "";
            if (message == "1") choice = "rub_belly";
            else if (message == "2") choice = "count_kick";
            else if (message == "3") choice = "water";
            else if (message == "4") choice = "rest";
            else if (message == "5") choice = "journal";
            if (choice != "")
                postAction("random_event_choice", llList2Json(JSON_OBJECT, ["eventType", gDialogEvent, "choice", choice]));
        }

        gDialogKind = "";
        gDialogEvent = "";
    }
    run_time_permissions(integer perm) { }

    on_rez(integer start)
    {
        llResetScript();
    }
}
