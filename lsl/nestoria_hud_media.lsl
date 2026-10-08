// NESTORIA - HUD media and frame helper. Compile with Mono.
// Required in the SAME ROOT PRIM as nestoria_main_hud.lsl and effects.
// Owns the screen, attach/teleport retries, and minimize/restore positions.
// Receives its URL from main; no API credentials are needed here.

integer MOAP_LINK = 2;
integer MOAP_FACE = 4;
integer SCREEN_WIDTH = 800;
integer SCREEN_HEIGHT = 450;
integer SCREEN_AUTO_SCALE = TRUE; // keep "Auto Scale Media on Face of Object" checked
float MEDIA_WATCH_SECONDS = 15.0;
string gMoapUrl = "";
integer gMediaReady = FALSE;
integer gMoapRetry = 0;
integer gNavigate = FALSE;
string gNavigationUrl = "";
integer gMediaErrorReported = FALSE;
integer gRefreshSerial = 0;
integer gMinimized = FALSE;
vector gFullScale;
list gSavedPos = [];

// Root-prim protocol (keep these values identical in all three HUD scripts).
// Commands carry only one params object in str, and the command name in id.
integer LM_COMMAND = 7100;
integer LM_ACTION = 7101;
integer LM_MEDIA_URL = 7102;
integer LM_SYNC = 7103;
integer LM_MEDIA_READY = 7104;

say(string msg)
{
    llOwnerSay("♥ Nestoria: " + msg);
}

integer moapLink()
{
    // A genuinely unlinked screen is valid. A missing configured child is not:
    // do not silently put the browser on the root or a decorative face instead.
    if (llGetLinkNumber() == 0) return LINK_THIS;
    if (MOAP_LINK < 1 || MOAP_LINK > llGetNumberOfPrims()) return 0;
    if (MOAP_LINK == llGetLinkNumber()) return LINK_THIS;
    return MOAP_LINK;
}

integer moapFace(integer link)
{
    if (MOAP_FACE < 0 || MOAP_FACE >= llGetLinkNumberOfSides(link)) return -1;
    return MOAP_FACE;
}

reportMediaError(string message)
{
    if (gMediaErrorReported) return;
    gMediaErrorReported = TRUE;
    say(message);
}

integer mediaSettingsMatch(list media)
{
    if (llGetListLength(media) != 6) return FALSE;
    return llList2Integer(media, 0) == SCREEN_AUTO_SCALE
        && llList2Integer(media, 1) == SCREEN_WIDTH
        && llList2Integer(media, 2) == SCREEN_HEIGHT
        && llList2Integer(media, 3) == TRUE
        && llList2String(media, 4) == gMoapUrl
        && llList2String(media, 5) != "";
}

list readMedia(integer link, integer face)
{
    return llGetLinkMedia(link, face, [
        PRIM_MEDIA_AUTO_SCALE, PRIM_MEDIA_WIDTH_PIXELS, PRIM_MEDIA_HEIGHT_PIXELS,
        PRIM_MEDIA_AUTO_PLAY, PRIM_MEDIA_HOME_URL, PRIM_MEDIA_CURRENT_URL
    ]);
}

float screenAlpha(integer link)
{
    if (gMinimized && link != LINK_THIS) return 0.0;
    return 1.0;
}

integer faceAligned(integer link, integer face)
{
    list texture = llGetLinkPrimitiveParams(link, [
        PRIM_TEXTURE, face, PRIM_COLOR, face, PRIM_FULLBRIGHT, face, PRIM_GLOW, face
    ]);
    if (llGetListLength(texture) != 8) return FALSE;
    return llVecDist(llList2Vector(texture, 1), <1.0, 1.0, 0.0>) < 0.0001
        && llVecDist(llList2Vector(texture, 2), ZERO_VECTOR) < 0.0001
        && llFabs(llList2Float(texture, 3)) < 0.0001
        && llVecDist(llList2Vector(texture, 4), <1.0, 1.0, 1.0>) < 0.0001
        && llFabs(llList2Float(texture, 5) - screenAlpha(link)) < 0.0001
        && llList2Integer(texture, 6) == TRUE
        && llFabs(llList2Float(texture, 7)) < 0.0001;
}

prepMoapFace(integer link, integer face)
{
    // Auto Scale maps the media to the whole texture. Old manual Align values
    // crop that mapping, so restore full-face repeats/offsets without deleting
    // the media or replacing its underlying inventory texture.
    list texture = llGetLinkPrimitiveParams(link, [PRIM_TEXTURE, face]);
    key image = llList2Key(texture, 0);
    if (image == NULL_KEY) image = TEXTURE_BLANK;
    llSetLinkPrimitiveParamsFast(link, [
        PRIM_COLOR, face, <1.0, 1.0, 1.0>, screenAlpha(link),
        PRIM_FULLBRIGHT, face, TRUE,
        PRIM_GLOW, face, 0.0,
        PRIM_TEXTURE, face, image, <1.0, 1.0, 0.0>, ZERO_VECTOR, 0.0
    ]);
}

integer applyMoap(integer link, integer face, integer navigate)
{
    // llSetLinkMedia overwrites supplied fields in place. Unspecified fields
    // stay unchanged. Clearing first is unnecessary and tears down the browser.
    list params = [
        PRIM_MEDIA_HOME_URL, gMoapUrl,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, SCREEN_AUTO_SCALE,
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
    ];
    // Repairing geometry or a checkbox must not reset the open tab, form or
    // scroll position. Only a new URL, missing media, or explicit refresh navigates.
    if (navigate) params += [PRIM_MEDIA_CURRENT_URL, gNavigationUrl];
    return llSetLinkMedia(link, face, params);
}

ensureMedia()
{
    integer link = moapLink();
    if (link == 0)
    {
        gMediaReady = FALSE;
        reportMediaError("Screen link is missing. Check MOAP_LINK in nestoria_hud_media.lsl.");
        return;
    }
    integer face = moapFace(link);
    if (face == -1)
    {
        gMediaReady = FALSE;
        reportMediaError("Screen face is missing. Check MOAP_FACE in nestoria_hud_media.lsl.");
        return;
    }

    list media = readMedia(link, face);
    integer navigate = gNavigate || llGetListLength(media) != 6
        || llList2String(media, 5) == "";
    if (gNavigationUrl == "") gNavigationUrl = gMoapUrl;
    integer status = STATUS_OK;
    if (navigate || !mediaSettingsMatch(media))
        status = applyMoap(link, face, navigate);
    if (status != STATUS_OK)
    {
        gMediaReady = FALSE;
        reportMediaError("Screen update failed (status " + (string)status + "). Retrying.");
        return;
    }
    if (!faceAligned(link, face)) prepMoapFace(link, face);

    // A successful call alone is insufficient: confirm the simulator's saved
    // media and texture values. Later timer ticks catch delayed attach changes.
    list confirmed = readMedia(link, face);
    gMediaReady = mediaSettingsMatch(confirmed) && faceAligned(link, face)
        && (!navigate || llList2String(confirmed, 5) == gNavigationUrl);
    if (gMediaReady)
    {
        gNavigate = FALSE;
        gMediaErrorReported = FALSE;
    }
    else reportMediaError("Screen settings have not settled yet. Retrying.");
}

scheduleMoap(integer times)
{
    if (times > gMoapRetry) gMoapRetry = times;
    llSetTimerEvent(1.0);
}

refreshMedia()
{
    if (gMoapUrl == "") return;
    ++gRefreshSerial;
    string separator = "#";
    if (llSubStringIndex(gMoapUrl, "#") != -1) separator = "&";
    // Generate this once per requested refresh, never once per retry.
    gNavigationUrl = gMoapUrl + separator + "n" + (string)llGetUnixTime()
        + "-" + (string)gRefreshSerial;
    gNavigate = TRUE;
    scheduleMoap(3);
}

/**
 * Shrink the HUD to a small tab in place.
 *
 * Children are hidden AND parked at <0, 0, -5> — in HUD coordinates that is
 * behind the viewer, so they neither draw nor take clicks. The root keeps its
 * proportions and simply scales down, which leaves a recognisable little tab
 * to touch rather than an invisible hotspot the wearer has to hunt for.
 */
minimizeHud()
{
    if (gMinimized) return;

    gFullScale = llGetScale();
    gSavedPos = [];

    integer n = llGetNumberOfPrims();
    integer i;
    for (i = 2; i <= n; ++i)
    {
        vector p = (vector)llList2String(
            llGetLinkPrimitiveParams(i, [PRIM_POS_LOCAL]), 0);
        gSavedPos += [i, p];
        llSetLinkAlpha(i, 0.0, ALL_SIDES);
        llSetLinkPrimitiveParamsFast(i, [PRIM_POS_LOCAL, <0.0, 0.0, -5.0>]);
    }

    // Keep the aspect, just make it small enough to sit out of the way.
    vector tab = gFullScale * 0.22;
    if (tab.x < 0.02) tab.x = 0.02;
    if (tab.y < 0.02) tab.y = 0.02;
    if (tab.z < 0.02) tab.z = 0.02;
    llSetScale(tab);

    gMinimized = TRUE;
    say("HUD tucked away - touch the little tab to bring it back.");
}

/** Put everything back, and resync on the way in. */
restoreHud()
{
    if (!gMinimized) return;

    integer count = llGetListLength(gSavedPos);
    integer i;
    for (i = 0; i < count; i += 2)
    {
        integer link = llList2Integer(gSavedPos, i);
        vector p = llList2Vector(gSavedPos, i + 1);
        llSetLinkPrimitiveParamsFast(link, [PRIM_POS_LOCAL, p]);
        llSetLinkAlpha(link, 1.0, ALL_SIDES);
    }
    if (gFullScale != ZERO_VECTOR) llSetScale(gFullScale);

    gSavedPos = [];
    gMinimized = FALSE;

    // The screen has been sitting behind the camera; re-apply the media and
    // re-register so it comes back live rather than on whatever it last had.
    gMediaReady = FALSE;
    scheduleMoap(3);
    llMessageLinked(LINK_THIS, LM_SYNC, "", NULL_KEY);
}

default
{
    state_entry()
    {
        // Retain the saved screen URL when this helper alone is recompiled.
        // Main supplies a new authenticated URL whenever registration changes it.
        integer link = moapLink();
        if (link != 0)
        {
            integer face = moapFace(link);
            if (face != -1)
            {
                gMoapUrl = llList2String(llGetLinkMedia(link, face, [PRIM_MEDIA_HOME_URL]), 0);
                gNavigationUrl = gMoapUrl;
            }
        }
        llMessageLinked(LINK_THIS, LM_MEDIA_READY, "", NULL_KEY);
        scheduleMoap(3);
    }

    attach(key id)
    {
        if (id == NULL_KEY)
        {
            // Keep URL and layout state in inventory, but stop the watchdog.
            llSetTimerEvent(0.0);
            return;
        }
        gMediaReady = FALSE;
        if (gMinimized) restoreHud();
        scheduleMoap(3);
        llMessageLinked(LINK_THIS, LM_MEDIA_READY, "", NULL_KEY);
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER)
        {
            restoreHud();
            llResetScript();
        }
        if (change & (CHANGED_REGION | CHANGED_TELEPORT | CHANGED_REGION_START
            | CHANGED_LINK | CHANGED_TEXTURE))
        {
            gMediaReady = FALSE;
            scheduleMoap(3);
        }
    }

    link_message(integer sender, integer num, string message, key data)
    {
        if (sender != llGetLinkNumber()) return;
        if (num == LM_MEDIA_URL)
        {
            if (message == "") return;
            if (message != gMoapUrl)
            {
                gMoapUrl = message;
                gNavigationUrl = message;
                gNavigate = TRUE;
            }
            scheduleMoap(3);
        }
        else if (num == LM_COMMAND)
        {
            string cmd = (string)data;
            if (cmd == "refresh_moap") refreshMedia();
            else if (cmd == "minimize") minimizeHud();
            else if (cmd == "restore") restoreHud();
        }
    }

    timer()
    {
        if (gMoapUrl == "")
        {
            llMessageLinked(LINK_THIS, LM_MEDIA_READY, "", NULL_KEY);
            llSetTimerEvent(2.0);
            return;
        }
        ensureMedia();
        if (gMoapRetry > 0) --gMoapRetry;
        if (gMoapRetry > 0) llSetTimerEvent(4.0);
        else llSetTimerEvent(MEDIA_WATCH_SECONDS);
    }

    touch_start(integer count)
    {
        if (llDetectedKey(0) != llGetOwner()) return;
        if (gMinimized) restoreHud();
        else
        {
            scheduleMoap(3);
            llMessageLinked(LINK_THIS, LM_SYNC, "", NULL_KEY);
            minimizeHud();
        }
    }

    on_rez(integer start)
    {
        // Reattachment also fires on_rez. Resetting here discards the URL and
        // queued recovery state; let attach() settle this existing script instead.
        if (gMinimized) restoreHud();
        gMediaReady = FALSE;
        scheduleMoap(3);
    }
}
