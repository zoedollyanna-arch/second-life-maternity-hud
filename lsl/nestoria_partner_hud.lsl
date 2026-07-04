// ============================================================================
// NESTORIA PREGNANCY HUD — Partner HUD script
// ----------------------------------------------------------------------------
// Worn by the partner. Pairs with the mom's pregnancy using the pairing code
// shown in her web dashboard (Partner panel → "Open Partner Hub").
//
// Touch the HUD for a menu of support actions. Every action is recorded on
// the server, boosts her support meter, and shows up in her dashboard feed.
//
// SETUP: set API_BASE and API_SECRET to match your server .env.
// Optional inventory: sound "nestoria_chime", anim "nestoria_hug".
// ============================================================================

string  API_BASE   = "https://second-life-maternity-hud.onrender.com";
string  API_SECRET = "30bacebfb360616f0028a0f21b2df23d31686e0be344994c";  // same value as SL_API_SECRET in the server .env

float   VOLUME = 0.7;

string  gToken = "";
string  gMomName = "";
key     gMomKey = NULL_KEY;
key     gHttpReq = NULL_KEY;
integer gListenHandle;
integer gMenuChannel;
integer gAwaitingCode = FALSE;
integer gAwaitingMessage = FALSE;

say(string msg) { llOwnerSay("♥ Nestoria Partner: " + msg); }

playSoundByName(string name)
{
    if (llGetInventoryType(name) == INVENTORY_SOUND) llPlaySound(name, VOLUME);
}

request(string path, string body)
{
    gHttpReq = llHTTPRequest(API_BASE + path, [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_BODY_MAXLENGTH, 16384
    ], body);
}

sendAction(string action, string note)
{
    list fields = ["token", gToken, "action", action, "source", "sl"];
    if (note != "") fields += ["note", note];
    request("/api/sl/action", llList2Json(JSON_OBJECT, fields));
}

askForCode()
{
    gAwaitingCode = TRUE;
    gMenuChannel = -1 - (integer)llFrand(1000000.0);
    llListenRemove(gListenHandle);
    gListenHandle = llListen(gMenuChannel, "", llGetOwner(), "");
    llTextBox(llGetOwner(),
        "Enter your pairing code.\n(She can find it on her dashboard in the Partner panel.)",
        gMenuChannel);
}

mainMenu()
{
    gMenuChannel = -1 - (integer)llFrand(1000000.0);
    llListenRemove(gListenHandle);
    gListenHandle = llListen(gMenuChannel, "", llGetOwner(), "");
    string who = gMomName;
    if (who == "") who = "your love";
    llDialog(llGetOwner(),
        "♥ Supporting " + who + " ♥\nEvery little thing counts.",
        ["Hug", "Bring Water", "Encourage", "Rub Back",
         "Attend Appt", "Send Message", "Re-Pair", "Status"],
        gMenuChannel);
}

default
{
    state_entry()
    {
        say("Touch me to pair with your partner's Nestoria HUD.");
    }

    attach(key id)
    {
        if (id != NULL_KEY && gToken == "") askForCode();
    }

    touch_start(integer n)
    {
        if (llDetectedKey(0) != llGetOwner()) return;
        if (gToken == "") askForCode();
        else mainMenu();
    }

    listen(integer channel, string name, key id, string message)
    {
        llListenRemove(gListenHandle);

        if (gAwaitingCode)
        {
            gAwaitingCode = FALSE;
            request("/api/sl/partner-link", llList2Json(JSON_OBJECT, [
                "secret", API_SECRET,
                "code", llStringTrim(message, STRING_TRIM),
                "object_key", (string)llGetKey(),
                "region", llGetRegionName()
            ]));
            say("Pairing…");
            return;
        }

        if (gAwaitingMessage)
        {
            gAwaitingMessage = FALSE;
            sendAction("partner_message", message);
            say("Message sent ♥");
            return;
        }

        if (message == "Hug")          { sendAction("hug", ""); playSoundByName("nestoria_chime"); }
        else if (message == "Bring Water")  sendAction("partner_water", "");
        else if (message == "Encourage")    sendAction("support", "");
        else if (message == "Rub Back")     sendAction("partner_backrub", "");
        else if (message == "Attend Appt")  sendAction("partner_appointment", "");
        else if (message == "Send Message")
        {
            gAwaitingMessage = TRUE;
            gMenuChannel = -1 - (integer)llFrand(1000000.0);
            gListenHandle = llListen(gMenuChannel, "", llGetOwner(), "");
            llTextBox(llGetOwner(), "Write a sweet message for her:", gMenuChannel);
        }
        else if (message == "Re-Pair") askForCode();
        else if (message == "Status") sendAction("partner_status", "");
    }

    http_response(key id, integer status, list meta, string body)
    {
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

        string momName = llJsonGetValue(body, ["mom_name"]);
        if (momName != JSON_INVALID) gMomName = momName;
        string momKey = llJsonGetValue(body, ["mom_key"]);
        if (momKey != JSON_INVALID) gMomKey = (key)momKey;

        string msg = llJsonGetValue(body, ["message"]);
        if (msg != JSON_INVALID && msg != "") say(msg);

        string anim = llJsonGetValue(body, ["anim"]);
        if (anim == "hug" && gMomKey != NULL_KEY)
            llWhisper(0, llKey2Name(llGetOwner()) + " wraps " + gMomName + " in a warm hug ♥");
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
    }

    on_rez(integer start) { }
}
