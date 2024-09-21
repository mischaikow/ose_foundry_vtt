// Reformatted code from MaineQat posted in OSE foundry VTT discord
// Done by doughnuts in OSE foundry VTT discord

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
  return monsterName.replace(/[\[\(].*[\]\)]/, "").trim();
};

const createSemicolonMonster = (rawString) => {
  // Incomplete list - need to fill in with more details
  const codes = {
    AC: "AC",
    HD: "HD",
    ATT: "ATT",
    ATK: "ATT",
    ML: "ML",
    AL: "AL",
  };

  const newMonster = {
    stats: {},
    abilities: [],
    desc: "",
  };

  rawString = rawString.replaceAll("\n", " ");
  const splitBySemicolon = rawString.split("; ");

  // These functions have side-effects and modify splitBySemicolon!
  newMonster.stats["HP"] = getHP(splitBySemicolon);
  newMonster["monsterName"] = getMonsterName(splitBySemicolon);

  splitBySemicolon.forEach((a_fact) => {
    a_fact = a_fact.trim();
    const firstWord = a_fact.substr(0, a_fact.indexOf(" ")).toUpperCase();

    if (firstWord in codes) {
      if (firstWord === "AC" && /.+\[.+\]/.test(a_fact)) {
        newMonster.stats["AC"] = a_fact.substring(
          a_fact.indexOf("[") + 1,
          a_fact.indexOf("]")
        );
      } else {
        newMonster.stats[codes[firstWord]] = a_fact.substr(
          a_fact.indexOf(" ") + 1
        );
      }
    } else if (firstWord === "SPEC") {
      const remainder_phrase = a_fact.substr(a_fact.indexOf(" ")).split(",");
      remainder_phrase.forEach((phrase) => {
        phrase = phrase.trim();
        newMonster.abilities.push(phrase);
      });
    } else {
      newMonster.desc = newMonster.desc.concat(a_fact);
    }
  });

  return newMonster;
};

// Parse the newfound knowledge
const parseMonster = async (name, desc, stats, abilities, folder) => {
  if (name === null) {
    ui.notifications.error("Name not detected");
    return;
  }
  if (stats === null) {
    ui.notifications.error("Stats not detected");
    return;
  }

  const SaveRemapping = {
    petrification: "paralysis",
    poison: "death",
    doom: "death",
    death: "doom",
    wands: "ray",
    paralysis: "hold",
    breathe: "blast",
    spell: "spell",
  };
  const AttackPatternColorSequence = [
    "green",
    "red",
    "yellow",
    "purple",
    "blue",
    "orange",
  ];

  //  Default system
  system = {
    details: {},
    hp: { hd: "1d8", value: 4, max: 4 },
    movement: { base: 60, encounter: 20, value: "" },
    thac0: { value: 19, bba: 0 },
  };

  // AC
  system.ac = { value: 19 - stats.AC };
  system.aac = { value: stats.AC };

  system.hp.hd = stats.HD;
  system.hp.max = stats.HP;
  system.hp.value = stats.HP;
  system.thac0.bba = stats.AB;

  // MV
  // system.exploration.ft = stats.MV;
  system.movement.base = stats.MV;
  system.movement.encounter = stats.MV;
  system.movement.value = stats.MV;

  // SV
  system.saves = {
    death: { value: /D(?<SV>\d+)/.exec(stats.SV)?.groups.SV || 19 },
    wand: { value: /R(?<SV>\d+)/.exec(stats.SV)?.groups.SV || 19 },
    paralysis: { value: /H(?<SV>\d+)/.exec(stats.SV)?.groups.SV || 19 },
    breath: { value: /B(?<SV>\d+)/.exec(stats.SV)?.groups.SV || 19 },
    spell: { value: /S(?<SV>\d+)/.exec(stats.SV)?.groups.SV || 19 },
  };

  //  Details
  system.details.morale = parseInt(stats.ML?.trim());
  system.details.alignment = stats.AL?.trim() || "Any";
  system.details.xp = parseInt(stats.XP?.replace(/,/g, ""));

  let biography = desc ? `<p>${desc}</p>\n<hr />\n` : "";

  if (abilities.length) {
    biography += "<hr />\n<ul>\n";
    abilities.forEach((ability) => {
      const ABILITY = /(?<NAME>[^:]+):\s*(?<DESC>.*)/.exec(ability);
      if (ABILITY) {
        biography += `<li>${ABILITY.groups.NAME}:&nbsp;${ABILITY.groups.DESC}</li>\n`;
      }
    });
    biography += "</ul>\n";
  }

  system.details.biography = biography;

  let actor = await Actor.create({
    name: name,
    type: "monster",
    system: system,
    folder: folder !== "" ? folder : null,
  });

  let abilityCount = 1;
  for (const ability of abilities) {
    const ABILITY = /(?<NAME>[^:]+):\s*(?<DESC>.*)/.exec(ability.trim());
    if (!ABILITY) {
      ABILITY = "Skill "
        .concat(abilityCount.toString())
        .concat(": ")
        .concat(ability.trim());
      abilityCount += 1;
    } else {
      const SAVE = /save (vs|versus) (?<SAVE>[bdpsw]\w+)/i.exec(
        ABILITY.groups.DESC
      )?.groups.SAVE;
      const ROLL = /(?<ROLL>\d+d\d+([+-]\d+)?)/.exec(ABILITY.groups.DESC)
        ?.groups.ROLL;
    }

    await actor.createEmbeddedDocuments("Item", [
      {
        name: ABILITY.groups.NAME.capitalize(),
        type: "ability",
        system: {
          description: ABILITY?.groups.DESC,
          save: SaveRemapping[SAVE] || SAVE || "",
          roll: ROLL || "",
          rollType: ROLL ? "above" : "result",
        },
      },
    ]);
  }

  let attackPatternCount = 0;
  for (const currAtt of stats.ATT.split("or")) {
    const patternColor = AttackPatternColorSequence[attackPatternCount++];

    for (const innerCurrAtt of currAtt.split("and")) {
      let thisCurrAttReg =
        /(?<COUNT>\d*|\s)\s(?<NAME>.*)\s\(\+(?<BONUS>\d+),\s(?<DICE>\d+d\d+)\)/.exec(
          " " + innerCurrAtt.replace("[", "").replace("]", "")
        );

      const name = thisCurrAttReg.groups.NAME;
      const count = parseInt(thisCurrAttReg.groups.COUNT || 1);
      const damage = thisCurrAttReg.groups.DICE;

      await actor.createEmbeddedDocuments("Item", [
        {
          name: name.trim().capitalize(),
          type: "weapon",
          system: {
            damage: damage || "0",
            save: "",
            bonus: 0,
            range: "",
            counter: { max: count, value: count },
            pattern: patternColor,
          },
        },
      ]);
    }
  }
};

//// Execution block

const [raw_value, folder] = await promptMonsterInput();
if (!raw_value) return;

const monster = createMonsterFromString(raw_value);
await parseMonster(
  monster.monsterName,
  monster.desc,
  monster.stats,
  monster.abilities,
  folder
);

//// Temp info
const raw_value_a = `Crookhorn
7′-tall, feral, disease-ridden breggles, twisted by the evil magic of their master, Atanuwë.
Roam northern Dolmenwood as pillagers, brigands, and burners of villages.
MeDiuM Mortal—sentient—chaotic
Level 2 AC 13 HP 2d8 (9) Saves D12 R13 H14 B15 S16
Attacks Weapon (+1) or bite (+1, 1d6 + disease)
or horns (+1, 1d6 + disease)
Speed 30 Morale 8 XP 35
Encounters 3d10 (25% in lair)
Behaviour Brutish, wild, merciless
Speech Obscenity-laced bleating. Gaffe, basic Woldish (1-in-4 is fluent)
Possessions 3d6sp Hoard C4 + R4 + M1
Weapons: Crookhorns favour clubs (1d4) and spears (1d6).
Armour: Crookhorns wear a rough patchwork of spiked
leather and chainmail. Without armour, they have AC 11.
Disease: Anyone who comes into close contact with a
crookhorn (including being bitten or butted by one) must
Save Versus Doom or be afflicted by a nasty infection (see
Crookhorn Diseases). All can be cured with Lankswith
(DPB).
Marauders: Crookhorns delight in the capture, torture,
and (inevitable) roasting of other sentients.`;

const raw_value_b = `Stygous: HD 4; AC 6 [13]; Atk beak 1d10; Spec
surprise 3:6, plucks out heart on max damage;
ML 9; AL C.
Hp 15`;

const raw_value_c = `Vincent Godefroy-Malévol: Thief 6; AC 8 [11];
Atk cane sword 1d6 + poison; Spec backstab,
thievery; ML 9; AL N; cane sword in walking
stick, snuff box with secret compartment
(3*poison), 1d3 books, pocket watch 500 gp,
1d6*200 gp, letter of marque.
Hp 25`;

const raw_value_d = `+Undead Lords (1d10): HD 1; AC 7 [12]; Atk
sword 1d6; ML 8; AL C; elegant but rotting
clothing, 1d6 gp each.
Hp 7`;

let monster_2 = createMonsterFromString(raw_value_a);
console.log(monster_2);
monster_2 = createMonsterFromString(raw_value_b);
console.log(monster_2);
monster_2 = createMonsterFromString(raw_value_c);
console.log(monster_2);
monster_2 = createMonsterFromString(raw_value_d);
console.log(monster_2);
