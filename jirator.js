#!/usr/bin/env node

//TODO:
//- add resolve issue witch message

const fs = require("fs");
const blessed = require("blessed");
const open = require("open");
const FETCH_TIMEOUT = 15_000; // 15 Seconds Timeout

const data = {
  assignToMeOpen: false,
  errorMessagesCall: true,
  commentsOpen: false,
  currentIssue: "",
  filterOpen: false,
  filter: process.env.JIRA_JQL_LIST
    ? JSON.parse(process.env.JIRA_JQL_LIST)
    : [["Set the JIRA_JQL_LIST in your environment variable", ""]],
  JIRA: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  helpOpen: false,
  issues: [],
  comments: {},
  writeCommentOpen: false,
};

class JiraAPI {
  constructor(host, apiToken) {
    this.host = host;
    this.baseUrl = `https://${host}/rest/api/2`;
    this.apiToken = apiToken;
  }

  async searchIssues(jql) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const response = await fetch(
      `${this.baseUrl}/search?jql=${encodeURIComponent(jql)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getMyAccountId() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const response = await fetch(`${this.baseUrl}/myself`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async assignToMe(issue) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const { name } = await this.getMyAccountId();

    const response = await fetch(`${this.baseUrl}/issue/${issue}/assignee`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: name }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.ok;
  }

  async watcher(issue, method = "GET", username = null) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    };

    if (username && method !== "DELETE") {
      options.body = JSON.stringify(username);
    }

    const response = await fetch(
      `${this.baseUrl}/issue/${issue}/watchers?username=${username}`,
      options,
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return method === "GET" ? await response.json() : true;
  }

  async watchIssue(issue) {
    const { name } = await this.getMyAccountId();
    return this.watcher(issue, "POST", name);
  }

  async unwatchIssue(issue) {
    const { name } = await this.getMyAccountId();
    return this.watcher(issue, "DELETE", name);
  }

  async getWatcher(issue) {
    return this.watcher(issue, "GET");
  }

  async getComments(issue) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const response = await fetch(`${this.baseUrl}/issue/${issue}/comment`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async writeComments(issue, comments) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const body = { body: comments };
    const response = await fetch(`${this.baseUrl}/issue/${issue}/comment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}

const logger = (data) => {
  fs.writeFile("debugLog.json", data.toString(), (err) => {
    if (err) {
      console.error("Error writing the debugLog.json: ", err);
    }
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";

  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

const jira = new JiraAPI(process.env.JIRA_HOST, process.env.JIRA_API_TOKEN);

const errorHandling = (message) => {
  const biggerText = (str) => {
    let result = "";
    for (let val of str) {
      result += val + " ";
    }
    return result;
  };

  if (data.errorMessagesCall) {
    data.errorMessagesCall = false;
    screen.append(errorBox);
    errorBox.show();
    errorBox.setContent(" " + biggerText(message) + " ");
    screen.render();

    setTimeout(() => {
      data.errorMessagesCall = true;
      errorBox.hide();
      screen.render();
    }, 4_000);
  }
};

const infoHandler = (message) => {
  screen.append(infoBox);
  infoBox.show();
  infoBox.setContent(" " + message + " ");
  screen.render();

  setTimeout(() => {
    infoBox.hide();
    screen.render();
  }, 4_000);
};

const loadingHandler = (status) => {
  if (status) {
    screen.append(loading);
    loading.show();
  } else {
    loading.hide();
  }
  screen.render();
};

// https://en.wikipedia.org/wiki/Levenshtein_distance
const levenshteinDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const searchInList = (query) => {
  const items = feedList.items.map((item) => item.getContent());
  const search = items.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );
  const levenshtein = items.filter((item) => {
    return item.split(" ").some((item) => {
      return (
        levenshteinDistance(
          item.toLowerCase().trim(),
          query.toLowerCase().trim(),
        ) <= Math.round(query.length * 0.3) // The longer the search term, the greater the allowable Levenshtein distance.
      );
    });
  });

  // remove duplicates
  search.push(...levenshtein.filter((item) => !search.includes(item)));

  if (!search.length) {
    return infoHandler("Search yielded no results");
  }
  data.issues.length = search.length;
  feedList.setItems(search);
  infoHandler(
    `I have found ${search.length} results,\n ${levenshtein.length} through error correction.\n Press {bold}r{/bold} to reload the list.`,
  );
  screen.render();
};

const screen = blessed.screen({
  smartCSR: true,
  title: "Jirator",
});

const feedList = blessed.list({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: "32%",
  keys: true,
  label: " Press ? for help ",
  border: { type: "line" },
  padding: { left: 1 },
  noCellBorders: true,
  invertSelected: false,
  scrollbar: {
    ch: " ",
    style: { bg: "blue" },
    track: {
      style: { bg: "grey" },
    },
  },
  style: {
    item: { hover: { bg: "blue" } },
    selected: { fg: "black", bg: "blue", bold: true },
    label: {
      fg: "lightgrey",
    },
  },
  focusable: true,
});

const description = blessed.box({
  parent: feedList,
  top: "32%",
  left: "0%",
  width: "100%",
  height: "70%",
  tags: true,
  label: " Description ",
  border: {
    type: "line",
  },
  padding: { top: 1, left: 1 },
  style: {
    fg: "white",
    border: {
      fg: "white",
    },
    label: {
      fg: "lightgrey",
    },
  },
  scrollbar: {
    ch: " ",
    track: {
      bg: "grey",
    },
    style: {
      bg: "white",
    },
  },
  keys: true,
  scrollable: true,
});

const comments = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "90%",
  height: "90%",
  tags: true,
  label: " comments ",
  border: {
    type: "line",
  },
  padding: { top: 1, left: 1 },
  style: {
    fg: "white",
    border: {
      fg: "white",
    },
    label: {
      fg: "lightgrey",
    },
  },
  scrollbar: {
    ch: " ",
    track: {
      bg: "grey",
    },
    style: {
      bg: "white",
    },
  },
  keys: true,
  focusable: true,
  scrollable: true,
  hidden: true,
});

const search = blessed.prompt({
  top: "center",
  left: "center",
  width: "50%",
  height: "30%",
  border: {
    type: "line",
  },
  style: {
    border: { fg: "white" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  label: " Search ",
  tags: true,
  focusable: true,
  keys: true,
  hidden: true,
});

const writeComments = blessed.prompt({
  top: "center",
  left: "center",
  width: "50%",
  height: "30%",
  border: {
    type: "line",
  },
  style: {
    border: { fg: "white" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  label: " Write a comment ",
  tags: true,
  keys: true,
  hidden: true,
});

const assignToMe = blessed.prompt({
  top: "center",
  left: "center",
  width: "50%",
  height: "30%",
  border: {
    type: "line",
  },
  style: {
    border: { fg: "white" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  label: " Assign to me ",
  tags: true,
  keys: true,
  hidden: true,
});

const watch = blessed.prompt({
  top: "center",
  left: "center",
  width: "50%",
  height: "50%",
  border: {
    type: "line",
  },
  style: {
    border: { fg: "white" },
    fg: "blue",
    label: {
      fg: "lightgrey",
    },
  },
  label: " Watch ",
  tags: true,
  keys: true,
  hidden: true,
});

const helpBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  height: "shrink",
  width: "50%",
  label: " Help ",
  border: { type: "line" },
  content: `  {bold}q|Esc{/bold}            {green-fg}Close Jirator{/green-fg}
  {bold}/{/bold}                {green-fg}Fuzzy Search (Levenshtein Distance){/green-fg}
  {bold}j{/bold}                {green-fg}Move down in the list{/green-fg}
  {bold}k{/bold}                {green-fg}Move up in the list{/green-fg}
  {bold}stg-j{/bold}            {green-fg}Move down description or comments{/green-fg}
  {bold}stg-k{/bold}            {green-fg}Move up description or comments{/green-fg}
  {bold}gg{/bold}               {green-fg}Jump to the first item in the list{/green-fg}
  {bold}G{/bold}                {green-fg}Jump to the last item in the list{/green-fg}
  {bold}a{/bold}                {green-fg}Assign current issue to me{/green-fg}
  {bold}c{/bold}                {green-fg}Open comments for the current issue{/green-fg}
  {bold}e{/bold}                {green-fg}Write a comment{/green-fg}
  {bold}f{/bold}                {green-fg}Open JQL Filter list{/green-fg}
  {bold}o{/bold}                {green-fg}Open the current issue in the browser{/green-fg}
  {bold}r{/bold}                {green-fg}Reload the current list.{/green-fg}
  {bold}w{/bold}                {green-fg}Add me as watcher{/green-fg}
  {bold}?{/bold}                {green-fg}Help{/green-fg}
`,
  tags: true,
  hidden: true,
});

const filter = blessed.list({
  parent: screen,
  top: "center",
  left: "center",
  width: "40%",
  height: "20%",
  keys: true,
  label: " JQL search and filter list ",
  border: { type: "line" },
  padding: { left: 1 },
  noCellBorders: true,
  invertSelected: false,
  scrollbar: {
    ch: " ",
    style: { bg: "blue" },
    track: {
      style: { bg: "grey" },
    },
  },
  style: {
    item: { hover: { bg: "blue" } },
    selected: { fg: "black", bg: "blue", bold: true },
    label: {
      fg: "lightgrey",
    },
  },
  hidden: true,
});

const errorBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "shrink",
  height: "shrink",
  label: " Error ",
  border: { type: "line" },
  style: {
    border: { fg: "red" },
    fg: "black",
    bg: "red",
    label: {
      fg: "red",
    },
  },
  hidden: true,
});

const infoBox = blessed.box({
  parent: screen,
  top: 2,
  right: 2,
  width: "shrink",
  height: "shrink",
  label: " Info ",
  border: { type: "line" },
  style: {
    border: { fg: "blue" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  hidden: true,
  tags: true,
});

const loading = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "shrink",
  height: "shrink",
  content: " L o a d i n g ",
  border: { type: "line" },
  style: {
    border: { fg: "yellow" },
    bold: true,
    fg: "black",
    bg: "yellow",
    label: {
      fg: "lightgrey",
    },
  },
  hidden: true,
});

screen.append(comments);
screen.append(description);
screen.append(feedList);
screen.append(search);
screen.append(writeComments);
screen.append(assignToMe);
screen.append(watch);

feedList.setItems(["Loading..."]);

const loadAndDisplayIssues = async () => {
  try {
    loadingHandler(true);
    data.issues.length = 0;
    const response = await jira.searchIssues(data.JIRA);
    //logger(JSON.stringify(response));
    const items = response.issues.map((item) => {
      data.issues.push({
        key: item.key,
        headline: item.fields.summary,
        labels: item.fields.labels,
        assignee: item.fields.assignee.name,
        reporter: item.fields.reporter.name,
        lastUpdate: item.fields.updated,
        duedate: item.fields.duedate,
        created: item.fields.created,
        watchCount: item.fields.watches.watchCount,
        status: item.fields.status.name,
        severity: item.fields.priority.name,
        summary: item.fields.summary,
        description: item.fields.description,
        reasonForPriority: item.fields.customfield_12898
          ? item.fields.customfield_12898
          : "Reason was not given",
      });
      return `[${item.key}] ${item.fields.summary}`;
    });

    feedList.setItems(items);
    loadingHandler(false);
    screen.render();
  } catch (error) {
    let message = "";
    if (error.name === "AbortError") {
      message = "API request timed out ";
    }
    errorHandling(message + error.message);
  }
};

const loadAndDisplayFilter = () => {
  const list = data.filter.map((item) => item[0]);
  filter.setItems(list);
};

loadAndDisplayFilter();
loadAndDisplayIssues();

screen.key("/", () => {
  search.input("", (_err, value) => {
    searchInList(value || "...");
  });
});

let firstGPressed = false;

screen.key(["g"], (_ch, _key) => {
  if (!firstGPressed) {
    firstGPressed = true;
    setTimeout(() => {
      if (firstGPressed) {
        firstGPressed = false;
      }
    }, 300);
  } else {
    if (data.filterOpen) {
      filter.select(0);
    } else {
      feedList.select(0);
    }
    firstGPressed = false;
    screen.render();
  }
});

screen.program.on("keypress", (_ch, key) => {
  if (key.name === "g" && key.shift) {
    if (data.filterOpen) {
      filter.select(feedList.items.length - 1);
    } else {
      feedList.select(feedList.items.length - 1);
    }
    screen.render();
  }
});

screen.key(["j"], (_ch, _key) => {
  if (data.filterOpen) {
    filter.down();
  } else {
    feedList.down();
  }
  screen.render();
});

screen.key(["k"], (_ch, _key) => {
  if (data.filterOpen) {
    filter.up();
  } else {
    feedList.up();
  }
  screen.render();
});

screen.key(["S-j"], (_ch, _key) => {
  if (data.commentsOpen) {
    comments.scroll(20);
  } else {
    description.scroll(20);
  }
  screen.render();
});

screen.key(["S-k"], (_ch, _key) => {
  if (data.commentsOpen) {
    comments.scroll(-20);
  } else {
    description.scroll(-20);
  }
  screen.render();
});

screen.key(["o"], (_ch, _key) => {
  open(`https://${process.env.JIRA_HOST}/browse/${data.currentIssue}`);
});

screen.key("?", () => {
  if (helpBox.hidden) {
    data.helpOpen = true;
    screen.append(helpBox);
    helpBox.show();
    screen.render();
  }
});

screen.key("e", () => {
  if (data.commentsOpen) {
    data.commentsOpen = false;
    comments.hide();
    screen.render();
  }

  writeComments.setLabel(` ${data.currentIssue} [ESC for exit]`);
  writeComments.input(
    "\n  {bold}{blue-fg}Type a comment and hit enter{/bold}{/blue-fg}",
    (_err, value) => {
      if (!value) return;
      infoHandler(value);
      jira
        .writeComments(data.currentIssue, value)
        .then((result) => {
          infoHandler(`Comment ${result.body} was created`);
        })
        .catch((err) => errorHandling(err.message));
    },
  );
});

screen.key("a", () => {
  assignToMe.setLabel(` Assign to me [ESC for exit] `);
  assignToMe.input(
    `\n  {bold}{blue-fg}Type yes and hit enter to assign {red-fg}${data.currentIssue}{/red-fg} to you{/blue-fg}{/bold}\n`,
    (_err, value) => {
      if (!value) return;
      jira
        .assignToMe(data.currentIssue)
        .then((result) => {
          infoHandler(` ${data.currentIssue} will be assigned to you`);
          loadAndDisplayIssues();
        })
        .catch((err) => errorHandling(err.message));
    },
  );
});

screen.key("w", () => {
  watch.setLabel(` Watch Issue [ESC for exit] `);
  jira
    .getWatcher(data.currentIssue)
    .then((result) => {
      const watching = result.isWatching ? "UNWATCH" : "WATCH";
      const watchers = result.watchers
        .map((item) => `  {bold}* {green-fg}${item.name}{/green-fg}{/bold}\n`)
        .join("");

      watch.input(
        `\n  {bold}{blue-fg}Type yes and hit enter to ${watching} {red-fg}${data.currentIssue}{/red-fg}{bold}{blue-fg}\n\n\n\n\n\n${watchers}`,
        (_err, value) => {
          if (!value) return;
          if (result.isWatching) {
            jira.unwatchIssue(data.currentIssue).then((result) => {
              infoHandler(` You unwatching ${data.currentIssue} now `);
            });
          } else {
            jira.watchIssue(data.currentIssue).then((result) => {
              infoHandler(` You watching ${data.currentIssue} now `);
            });
          }
          setTimeout(() => {
            data.issues.length = 0;
            loadAndDisplayIssues();
          }, 1_077);
        },
      );
    })
    .catch((err) => errorHandling(err.message));
});

screen.key(["c"], (_ch, _key) => {
  screen.append(comments);
  data.commentsOpen = true;
  comments.show();
});

screen.key(["r"], (_ch, _key) => {
  loadAndDisplayIssues();
});

screen.key(["f"], (_ch, _key) => {
  screen.append(filter);
  data.filterOpen = true;
  filter.show();
});

screen.key(["enter"], (_ch, _key) => {
  const selectedIndexFilter = filter.selected;
  if (selectedIndexFilter !== undefined && data.filterOpen) {
    data.JIRA = data.filter[selectedIndexFilter][1];
    data.filterOpen = false;
    infoHandler("Loading ..." + data.JIRA);
    data.issues.length = 0;
    loadAndDisplayIssues();
    feedList.setLabel(
      " " + data.filter[selectedIndexFilter][0] + " Press ? for help ",
    );
    filter.hide();
  }
});

screen.key(["escape", "q"], (_ch, _key) => {
  if (data.filterOpen) {
    data.filterOpen = false;
    filter.hide();
    screen.render();
    return;
  }
  if (data.assignToMeOpen) {
    data.assignToMeOpen = false;
    assignToMe.hide();
    screen.render();
    return;
  }
  if (data.writeCommentOpen) {
    data.writeCommentOpen = false;
    writeComments.hide();
    screen.render();
    return;
  }
  if (data.commentsOpen) {
    data.commentsOpen = false;
    comments.hide();
    screen.render();
    return;
  }
  if (data.helpOpen) {
    data.helpOpen = false;
    helpBox.hide();
    screen.render();
    return;
  }
  screen.destroy();
  return process.exit(0);
});

const severity = (type) => {
  if (type === "Critical") return `{red-fg}${type}{/red-fg}`;
  if (type === "Medium") return `{yellow-fg}${type}{/yellow-fg}`;

  return type;
};

const spaces = (num, max) => {
  let space = "";
  for (let i = 0; i < max - num; i++) {
    space += " ";
  }

  return space;
};

const line = (num) => {
  let line = "";
  for (let i = 0; i < num - 5; i++) {
    line += "-";
  }

  return line;
};

setInterval(() => {
  const selectedIndexMain = feedList.selected;
  if (selectedIndexMain !== undefined && data.issues[selectedIndexMain]) {
    data.currentIssue = data.issues[selectedIndexMain].key;
    const max = Math.max(
      data.issues[selectedIndexMain].key.length,
      data.issues[selectedIndexMain].assignee.length,
      data.issues[selectedIndexMain].reporter.length,
      data.issues[selectedIndexMain].status.length,
      data.issues[selectedIndexMain].severity.length,
    );

    description.setContent(
      `{bold}Issue:{/bold}{blue-fg}      ${data.issues[selectedIndexMain].key}{/blue-fg}` +
        `          ${spaces(data.issues[selectedIndexMain].key.length, max)}{bold}Watchers:{/bold}{blue-fg}   ${data.issues[selectedIndexMain].watchCount}{/blue-fg}\n` +
        `{bold}Assignee:{/bold}{blue-fg}   ${data.issues[selectedIndexMain].assignee}{/blue-fg}` +
        `          ${spaces(data.issues[selectedIndexMain].assignee.length, max)}{bold}Labels:{/bold}{blue-fg}     ${data.issues[selectedIndexMain].labels.toString()}{/blue-fg}\n` +
        `{bold}Reporter:{/bold}{blue-fg}   ${data.issues[selectedIndexMain].reporter}{/blue-fg}` +
        `          ${spaces(data.issues[selectedIndexMain].reporter.length, max)}{bold}DueDate:{/bold}{green-fg}    ${formatDate(data.issues[selectedIndexMain].duedate)}{/green-fg}\n` +
        `{bold}Status:{/bold}{blue-fg}     ${data.issues[selectedIndexMain].status}{/blue-fg}` +
        `          ${spaces(data.issues[selectedIndexMain].status.length, max)}{bold}Created:{/bold}{green-fg}    ${formatDate(data.issues[selectedIndexMain].created)}{/green-fg}\n` +
        `{bold}Priority:{/bold}{blue-fg}   ${severity(data.issues[selectedIndexMain].severity)}{/blue-fg}` +
        `          ${spaces(data.issues[selectedIndexMain].severity.length, max)}{bold}LastUpdate:{/bold}{green-fg} ${formatDate(data.issues[selectedIndexMain].lastUpdate)}{/green-fg}\n\n` +
        `{bold}Reason for Priority:{/bold}\n{yellow-fg}${data.issues[selectedIndexMain].reasonForPriority}{/yellow-fg}\n` +
        `${line(description.width)}\n` +
        `{bold}Description:{/bold}{blue-fg}\n\n${data.issues[selectedIndexMain].description || "No description available"}{/blue-fg}`,
    );
    description.setLabel(" Description (" + data.issues.length + ") Issues ");

    if (data.currentIssue !== "") {
      if (!data.comments[data.currentIssue]) {
        jira
          .getComments(data.currentIssue)
          .then((value) => {
            const commentList = value.comments.map((item) => {
              return (
                `{bold}From:{/bold} ${item.author.displayName}\n` +
                `{blue-fg}${item.body}{/blue-fg}\n\n` +
                `{bold}Last update:{/bold} ${item.updated}\n\n`
              );
            });
            commentList.unshift(
              `{bold}{green-fg}> ${data.issues[selectedIndexMain]?.summary}{/green-fg}{/bold}\n\n`,
            );
            if (commentList.length === 1)
              commentList.push("{bold}No comments...{/bold}");

            data.comments[data.currentIssue] = [...commentList];
          })
          .catch((err) => errorHandling(err.message));
      }
      if (data.comments[data.currentIssue]) {
        comments.setLabel(`Comments for ${data.currentIssue} [quit width q]`);
        comments.setContent(data.comments[data.currentIssue].join(""));
      }
    }
  }
  screen.render();
}, 600);
