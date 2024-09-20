// Reformatted code from MaineQat posted in OSE foundry VTT discord

// No improvements made to original OSE importer:
// Edited from previous OSE monster importers. Has issues with xp values of 4 digits or more, some attacks, other speed types, monsters without descriptions under thier names (like those in the Animals section).

const OSE_PDF = "ose_pdf";
const OSE_REGEX =
  /^\s*(?<NAME>\S[^\n]+\s*)\n+(?:\s*(?<DESC>\S.+)\n+)(?<TYPE>\S[^\n]+\s*)(?<STATS>Level.*XP [0-9,]*)\s(?<ABILITIES>.*)/gs;
const SEMICOLON_COPY = "semicolon_copy";
const SEMICOLON_REGEX = /[^]+: [^]+; [^]+\.[^]*(H|h)(P|p)/;
const BAD_FORMAT = "bad_format";

// User prompt
const createInputDialogContent = () => {
  const folders = game.actors.directory.folders.map(
    (f) =>
      `<option value="${f._id}"${
        f._id === this.previouslySelectedFolder ? " selected" : ""
      }>${f.name}</option>`
  );

  return `<form>
            <div>
              <label for="folder">Folder:</label>
              <select name="folder" id="folder">
                <option value="">(None)</option>
                ${folders.join("\n")}
              </select>
              <p>Paste Monster</p>
              <p><textarea name="inputField" rows="10" columns="100"></textarea></p>
            </div>
          </form>`;
};

const promptMonsterInput = async () => {
  const inputDialogContent = createInputDialogContent();

  const prompt = new Promise((resolve, reject) => {
    new Dialog({
      title: "Paste Monster",
      content: inputDialogContent,
      width: 300,
      height: 500,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: `Create`,
          callback: (html) => {
            let result = html.find("textarea[name='inputField']")?.val();
            let folder = html.find("select[id='folder']")?.val();
            resolve([result.trim(), folder]);
          },
        },
      },
      default: "yes",
      close: (html) => {
        reject();
      },
    }).render(true);
  });

  return prompt.then((res) => res).catch((err) => undefined);
};

// Create the monster from the string of stuff
const inputPatternMatcher = (rawString) => {
  if (OSE_REGEX.test(rawString)) {
    return OSE_PDF;
  } else if (SEMICOLON_REGEX.test(rawString)) {
    return SEMICOLON_COPY;
  } else {
    return BAD_FORMAT;
  }
};

const createMonsterFromString = (rawString) => {
  const inputFormat = inputPatternMatcher(rawString);

  if (inputFormat === OSE_PDF) {
    //ui.notifications.notify("Monster is of type ose");
    return createOSEMonster(rawString);
  } else if (inputFormat === SEMICOLON_COPY) {
    //ui.notifications.notify("Monster is of type semicolon");
    return createSemicolonMonster(rawString);
  } else {
    //ui.notifications.notify("Monster is of unknown format");
    return;
  }
};

const createOSEMonster = (rawString) => {
  let monsterName = "";
  let desc = "";
  let stats = {};
  let abilities = [];

  let monster = undefined;
  if (
    (monster =
      /^\s*(?<NAME>\S[^\n]+\s*)\n+(?:\s*(?<DESC>\S.+)\n+)(?<TYPE>\S[^\n]+\s*)(?<STATS>Level.*XP [0-9,]*)\s(?<ABILITIES>.*)/gs.exec(
        rawString
      ))
  ) {
    //  OSE PDF format; fix up potential spaces
    monsterName = monster.groups.NAME;
    desc = monster.groups.DESC?.replace(/\n/g, " ") || "";

    stats["AC"] = /AC\s[0-9]*/
      .exec(monster.groups.STATS)
      ?.toString()
      .split(" ")[1];
    stats["HP"] = /HP\s[0-9]*d[0-9]*\s\([0-9]*\)/
      .exec(monster.groups.STATS)
      ?.toString()
      .split(" ")[2]
      .replace("(", "")
      .replace(")", "");
    stats["HD"] = /HP\s[0-9]*d[0-9]*\s\([0-9]*\)/
      .exec(monster.groups.STATS)
      ?.toString()
      .split(" ")[1];
    stats["ATT"] = /(Att|Attacks)(.|\n)*Speed/
      .exec(monster.groups.STATS)[0]
      ?.toString()
      .replace("Attacks ", "")
      .replace("Att ", "")
      .replace(" Speed", "");
    stats["MV"] = /Speed\s[0-9]*/
      .exec(monster.groups.STATS)
      ?.toString()
      .replace("Speed ", "");
    stats["SV"] = /Saves(.|\n)*Att/
      .exec(monster.groups.STATS)
      ?.toString()
      .replace("Att", "")
      .replace("Saves ", "");
    stats["ML"] = /Morale (.|\n)*XP/
      .exec(monster.groups.STATS)
      ?.toString()
      .replace("XP", "")
      .replace("Morale ", "");
    stats["AL"] = monster.groups.TYPE?.split("—")[2]?.toString();
    stats["XP"] = /XP\s[0-9]*/
      .exec(monster.groups.STATS)
      ?.toString()
      .replace("XP ", "");
    stats["AB"] = /\((-|\+)[0-9]*/
      .exec(stats["ATT"])[0]
      ?.toString()
      .replace("(+", "")
      .replace(",", "");

    const abilities1 = /[a-zA-Z]*:.*$/s.exec(monster.groups.ABILITIES);

    const abilNames = abilities1[0]
      .toString()
      .match(/\n.*:|^.*:/g)
      .map((x) => x.replace(/\n/g, " "));
    const abilDesc = abilities1
      .toString()
      .split(/\n.*:|^.*:/g)
      .filter((x) => x != "")
      .map((x) => x.replace(/\n/g, " "));

    for (let index = 0; index < abilNames.length; index++) {
      abilities.push(abilNames[index] + abilDesc[index]);
    }
  }
  return {
    monsterName: monsterName,
    stats: stats,
    abilities: abilities,
    desc: desc,
  };
};

const getHP = (stringArray) => {
  const [temp, temp_hp] = stringArray.pop().split(".");
  stringArray.push(temp);
  const hp_array = temp_hp.trim().split(" ");
  return Number(hp_array.pop().trim());
};

const getMonsterName = (stringArray) => {
  const [monsterName, temp_stat] = stringArray.shift().split(":");
  stringArray.push(temp_stat);
  return monsterName;
};

const createSemicolonMonster = (rawString) => {
  // Incomplete list - need to fill in with more details
  const codes = {
    AC: "AC",
    HD: "HD",
    ATT: "ATT",
    ATK: "ATT",
    ML: "ML",
    Spec: "Spec",
    AL: "AL",
  };

  const newMonster = {
    stats: {},
  };

  rawString = rawString.replaceAll("\n", " ");
  const splitBySemicolon = rawString.split("; ");

  // These functions have side-effects and modify splitBySemicolon!
  newMonster.stats["HP"] = getHP(splitBySemicolon);
  newMonster["monsterName"] = getMonsterName(splitBySemicolon);

  splitBySemicolon.forEach((a_fact) => {
    const firstWord = a_fact.substr(0, a_fact.indexOf(" "));
    if (firstWord in codes) {
      newMonster.stats[codes[firstWord]] = a_fact.substr(
        a_fact.indexOf(" ") + 1
      );
    }
  });

  console.log(newMonster);

  return newMonster;
};

// Parse the newfound knowledge
const parseMonster = () => {
  return;
};

//// Execution block

const [raw_value, folder] = await promptMonsterInput();
if (!raw_value) return;

const monster = createMonsterFromString(raw_value);

console.log(monster);
