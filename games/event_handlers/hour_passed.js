
const log = require("../../logger.js");
const MessagePayload = require("../../discord/prototypes/message_payload.js");
const botClientWrapper = require("../../discord/wrappers/bot_client_wrapper.js");


module.exports = async (game, dom5Events) =>
{
    const gameName = game.getName();
    const status = game.getLastKnownStatus();
    const allNationData = status.getPlayers();
    const hourMarkPassed = dom5Events.getLastHour();

    
    try
    {
        log.general(log.getVerboseLevel(), `${gameName}\tHour mark ${hourMarkPassed} passed.`);
        await _processNewHourReminders(game, allNationData, hourMarkPassed);
    }

    catch(err)
    {
        // Log the error
        log.error(log.getLeanLevel(), `${gameName} hour passed event error`, err.stack);

        // Attempt to inform players of the new turn error
        game.sendGameAnnouncement(
            `An hour passed, but could not process player reminders. Make sure to check your turns.`
        );
    }
};


async function _processNewHourReminders(game, allNationData, hourMarkPassed)
{
    const playerFiles = game.getPlayerFiles() ?? [];

    playerFiles.forEach((playerFile) => 
    {
        try
        {
            return _processPlayerReminders(game, playerFile, allNationData, hourMarkPassed);
        }

        catch(err)
        {
            log.error(log.getNormalLevel(), `Error sending turn reminder to user ${playerFile.getId()}`, err);
        }
    });
}

async function _processPlayerReminders(game, playerFile, allNationData, hourMarkPassed)
{
    const gameName = game.getName();
    const preferences = playerFile.getEffectiveGamePreferences(gameName);
    const controlledNationFilenames = playerFile.getControlledNationFilenamesInGame(gameName);
    var controlledNationData;


    if (preferences.hasReminderAtHourMark(hourMarkPassed) === false)
        return;

    if (controlledNationFilenames.length < 0)
        return;


    controlledNationData = allNationData.filter((nationData) =>
    {
        return controlledNationFilenames.includes(nationData.filename);
    });

    await _sendPlayerReminders(game, controlledNationData, preferences, hourMarkPassed);
}

async function _sendPlayerReminders(game, controlledNationData, preferences, hourMarkPassed)
{
    const gameName = game.getName();
    const userWrapper = await botClientWrapper.fetchUser(preferences.getPlayerId());
    var reminderMsg = `**${gameName} ${hourMarkPassed}-hour reminder**. Current turn status:\n\n`;
    var turnListMsg = "";


    for (let nationData of controlledNationData)
    {
        if (nationData == null)
            continue;

        if (nationData.isTurnFinished === true &&
            preferences.isReceivingRemindersWhenTurnIsDone() === false)
        {
            continue;
        }

        turnListMsg += `${nationData.fullName}: ${_turnStatusToString(nationData)}\n`;
    }

    await userWrapper.sendMessage(new MessagePayload(reminderMsg + turnListMsg.toBox()));
}

function _turnStatusToString(turnData)
{
    if (turnData == null)
        return "Unknown";

    if (turnData.isTurnFinished === true)
        return "Finished";

    else if (turnData.isTurnUnfinished === true)
        return "Marked as Unfinished";

    else return "Unchecked";
}