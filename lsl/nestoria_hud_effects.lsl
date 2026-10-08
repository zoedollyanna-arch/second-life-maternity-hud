// NESTORIA - HUD effects and dialog helper. Compile with Mono.
// Required in the SAME ROOT PRIM as main and media, with all animations,
// sounds and prop objects. Receives one command at a time over link messages.
// Dialog choices go back to main for authenticated HTTP; no API secret here.

float VOLUME = 0.7;
string gCurrentAnim = "";
string gPendingAnim = "";
integer gListenHandle;
integer gMenuChannel;
string gDialogKind = "";
string gDialogEvent = "";
string gDialogId = "";
list gDialogKeys = [];
list gDialogLabels = [];

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

playSoundByName(string name)
{
    if (llGetInventoryType(name) == INVENTORY_SOUND)
        llPlaySound(name, VOLUME);
}

stopCurrentAnim()
{
    gPendingAnim = "";
    if (gCurrentAnim == "") return;
    if (llGetPermissions() & PERMISSION_TRIGGER_ANIMATION)
        llStopAnimation(gCurrentAnim);
    gCurrentAnim = "";
}

// Play an animation from the HUD's contents if it is there. Every animation
// the board asks for has a hook, whether or not the asset exists yet — drop in
// an animation with the matching name and it starts working, no script edit.
//
// Expected names (all optional):
//   nestoria_rest      nestoria_sleep     nestoria_yawn
//   nestoria_drink     nestoria_vitamins  nestoria_belly_hold
//   nestoria_vomit     nestoria_cry       nestoria_bathroom
//   nestoria_comfort   nestoria_contraction
startAnimByName(string name)
{
    if (llGetInventoryType(name) != INVENTORY_ANIMATION) return;
    if (!(llGetPermissions() & PERMISSION_TRIGGER_ANIMATION))
    {
        gPendingAnim = name;
        llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION);
        return;
    }
    stopCurrentAnim();
    llStartAnimation(name);
    gCurrentAnim = name;
}

/**
 * Play `name`, falling back to `fallback` when that animation has not been
 * made yet. Keeps "Sleep" working with only a rest animation in inventory,
 * while using a real sleep animation the moment one is added.
 */
startAnimOr(string name, string fallback)
{
    if (llGetInventoryType(name) == INVENTORY_ANIMATION) startAnimByName(name);
    else if (fallback != "") startAnimByName(fallback);
}

playSoundOr(string name, string fallback)
{
    if (llGetInventoryType(name) == INVENTORY_SOUND) playSoundByName(name);
    else if (fallback != "") playSoundByName(fallback);
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
    // 1.5s, and llSleep would block the helper's other queued commands.
    // The burst ends itself.
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

/**
 * Rez the aftermath, if the object is there. `nestoria_mess` is expected to
 * clean itself up on a timer the way the comfort chair does — the HUD only
 * puts it on the floor in front of her.
 */
rezMess()
{
    if (llGetInventoryType("nestoria_mess") != INVENTORY_OBJECT) return;
    list details = llGetObjectDetails(llGetOwner(), [OBJECT_POS, OBJECT_ROT]);
    vector ownerPos = llList2Vector(details, 0);
    rotation ownerRot = llList2Rot(details, 1);
    llRezObject("nestoria_mess", ownerPos + <0.7, 0.0, -0.9> * ownerRot,
        ZERO_VECTOR, ownerRot, 1);
}

openEventDialog(string params)
{
    string title = llJsonGetValue(params, ["title"]);
    string body = llJsonGetValue(params, ["body"]);
    string choices = llJsonGetValue(params, ["choices"]);
    gDialogKind = llJsonGetValue(params, ["kind"]);
    gDialogEvent = llJsonGetValue(params, ["eventType"]);
    gDialogId = llJsonGetValue(params, ["eventId"]);
    if (title == JSON_INVALID) title = "Nestoria";
    if (body == JSON_INVALID) body = "";
    if (choices == JSON_INVALID) choices = "";
    if (gDialogKind == JSON_INVALID) gDialogKind = "event";
    if (gDialogEvent == JSON_INVALID) gDialogEvent = "";
    if (gDialogId == JSON_INVALID) gDialogId = "";

    gDialogKeys = [];
    gDialogLabels = [];
    list buttons = [];

    integer i;
    list pairs = llParseString2List(choices, [";"], []);
    integer count = llGetListLength(pairs);
    if (count > 11) count = 11;          // llDialog allows 12; keep one for Close
    for (i = 0; i < count; ++i)
    {
        list kv = llParseString2List(llList2String(pairs, i), ["|"], []);
        // NOT "key" — that is an LSL type name and will not compile.
        string choiceKey = llList2String(kv, 0);
        string choiceLabel = llList2String(kv, 1);
        if (choiceKey != "")
        {
            if (choiceLabel == "") choiceLabel = choiceKey;
            // llDialog truncates button text at 24 bytes.
            if (llStringLength(choiceLabel) > 24)
                choiceLabel = llGetSubString(choiceLabel, 0, 23);
            gDialogKeys += [choiceKey];
            gDialogLabels += [choiceLabel];
            buttons += [choiceLabel];
        }
    }

    // Fallback for an older server that has not been redeployed yet.
    if (llGetListLength(buttons) == 0)
    {
        if (gDialogKind == "craving")
        {
            gDialogKeys = ["eat", "healthy", "ask_partner", "ignore", "journal"];
            buttons = ["Eat it", "Healthy swap", "Ask partner", "Push through", "Journal it"];
            gDialogLabels = buttons;
        }
        else
        {
            gDialogKeys = ["rub_belly", "water", "rest", "journal", "ask_partner"];
            buttons = ["Rub belly", "Water", "Rest", "Journal it", "Ask partner"];
            gDialogLabels = buttons;
        }
    }

    gMenuChannel = -1 - (integer)llFrand(1000000.0);
    llListenRemove(gListenHandle);
    gListenHandle = llListen(gMenuChannel, "", llGetOwner(), "");

    // llDialog caps the message at 512 bytes; trim the body, never the title.
    string message = title + "\n\n" + body;
    if (llStringLength(message) > 400) message = llGetSubString(message, 0, 399) + "...";

    llDialog(llGetOwner(), message, buttons + ["Close"], gMenuChannel);
}

giveProp(string item)
{
    list allowed = ["nestoria_chocolate_fruit_toast", "nestoria_smoothie",
        "nestoria_chocolate_bar", "nestoria_salmon_bagel", "nestoria_water", "nestoria_prenatals"];
    if (llListFindList(allowed, [item]) == -1) return;
    if (llGetInventoryType(item) != INVENTORY_OBJECT)
    {
        say("Missing prop: " + item + ". Put the prepared object in the HUD root contents. No care has been credited.");
        return;
    }
    if (!(llGetInventoryPermMask(item, MASK_OWNER) & PERM_COPY))
    {
        say(item + " needs Copy permission for this wearer before the attached HUD can give it.");
        return;
    }
    llGiveInventory(llGetOwner(), item);
    say("Inventory offer sent for " + item + ". Accept, then Add it to enjoy your little care moment ♥");
}

postAction(string action, string params)
{
    llMessageLinked(LINK_THIS, LM_ACTION, params, (key)action);
}

runCommand(string cmd, string params)
{
    if (cmd == "give_prop")
    {
        giveProp(llJsonGetValue(params, ["item"]));
    }
    else if (cmd == "say")
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
    else if (cmd == "rez_chair")
    {
        rezChair();
        startAnimOr("nestoria_comfort", "");
    }
    else if (cmd == "stop_anim")
    {
        stopCurrentAnim();
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
        startAnimOr("nestoria_contraction", "nestoria_rest");
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
        startAnimOr("nestoria_sleep", "nestoria_rest");
        playSoundOr("nestoria_yawn", "");
        say("You settle in to sleep.");
    }
    else if (cmd == "yawn")
    {
        startAnimOr("nestoria_yawn", "nestoria_rest");
        playSoundOr("nestoria_yawn", "");
        say("A yawn steals the end of the sentence.");
    }
    else if (cmd == "vomit")
    {
        vomitBurst();
        startAnimOr("nestoria_vomit", "nestoria_rest");
        playSoundOr("nestoria_vomit", "nestoria_chime");
        rezMess();
        say("A wave of sickness hits.");
    }
    else if (cmd == "cry")
    {
        startAnimOr("nestoria_cry", "");
        playSoundOr("nestoria_cry", "");
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
        startAnimOr("nestoria_bathroom", "");
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
        startAnimOr("nestoria_contraction", "nestoria_rest");
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

default
{
    state_entry()
    {
        llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION);
    }

    attach(key id)
    {
        if (id != NULL_KEY)
            llRequestPermissions(llGetOwner(), PERMISSION_TRIGGER_ANIMATION);
        else stopCurrentAnim();
    }

    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
    }

    link_message(integer sender, integer num, string params, key data)
    {
        if (sender != llGetLinkNumber() || num != LM_COMMAND) return;
        runCommand((string)data, params);
    }

    listen(integer channel, string name, key id, string message)
    {
        if (channel != gMenuChannel || id != llGetOwner()) return;
        llListenRemove(gListenHandle);
        if (message == "Close")
        {
            // Only an RP event has a pending row on the server to close. A
            // craving dialog is already recorded, so dismissing here would
            // close whatever event happens to be open instead.
            if (gDialogKind == "event") postAction("event_dismiss", "{}");
            gDialogKind = "";
            gDialogEvent = "";
            gDialogId = "";
            gDialogKeys = [];
            gDialogLabels = [];
            return;
        }

        // Button index -> the choice key the server sent alongside it.
        integer idx = llListFindList(gDialogLabels, [message]);
        string choice = "";
        if (idx >= 0 && idx < llGetListLength(gDialogKeys))
            choice = llList2String(gDialogKeys, idx);

        if (choice != "")
        {
            if (gDialogKind == "craving")
            {
                postAction("craving_choice", llList2Json(JSON_OBJECT, ["choice", choice]));
            }
            else
            {
                postAction("random_event_choice", llList2Json(JSON_OBJECT,
                    ["eventType", gDialogEvent, "eventId", gDialogId, "choice", choice]));
            }
        }

        gDialogKind = "";
        gDialogEvent = "";
        gDialogId = "";
        gDialogKeys = [];
        gDialogLabels = [];
    }

    run_time_permissions(integer perm)
    {
        if (perm & PERMISSION_TRIGGER_ANIMATION)
        {
            string pending = gPendingAnim;
            gPendingAnim = "";
            if (pending != "") startAnimByName(pending);
        }
        else gPendingAnim = "";
    }

    on_rez(integer start)
    {
        llResetScript();
    }
}
