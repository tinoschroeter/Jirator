#!/usr/bin/env node

//TODO:
//- add resolve issue witch message
//- add assign to me

const fs = require("fs");
const blessed = require("blessed");
const open = require("open");
const FETCH_TIMEOUT = 15_000; // 15 Seconds Timeout

const data = {
  commentsOpen: false,
  currentIssue: "",
  filterOpen: false,
  filter: process.env.JIRA_JQL_LIST
    ? JSON.parse(process.env.JIRA_JQL_LIST)
    : [["Set the JIRA_JQL_LIST in your environment variable", ""]],
  JIRA: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  helpOpen: false,
  issues: [],
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
const jira = new JiraAPI(process.env.JIRA_HOST, process.env.JIRA_API_TOKEN);

const errorHandling = (message) => {
  screen.append(errorBox);
  errorBox.show();
  errorBox.setContent(message);
  screen.render();

  setTimeout(() => {
    errorBox.hide();
    screen.render();
  }, 4_000);
};

const infoHandler = (message) => {
  screen.append(infoBox);
  infoBox.show();
  infoBox.setContent(" " + message + " ");
  screen.render();

  setTimeout(() => {
    infoBox.hide();
    screen.render();
  }, 3_000);
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

const searchInList = (query) => {
  const items = feedList.items.map((item) => item.getContent());
  const index = items.findIndex((item) =>
    item.toLowerCase().includes(query.toLowerCase()),
  );

  feedList.select(index !== -1 ? index : 0);
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

const helpBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  height: "shrink",
  width: "50%",
  label: " Help ",
  content: ` q|Esc          Close Jirator 
 /              Search
 w              Write a comment
 j              Move down in the list
 k              Move up in the list
 stg-j          Move down Description
 stg-k          Move up Description
 gg             Jump to the first item in the list
 G              Jump to the last item in the list
 c              Open comments for the current issue
 f              Open JQL Filter list 
 o              Open the current issue in the browser
 ?              Help
`,
  border: { type: "line" },
  style: {
    border: { fg: "white" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
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
  width: "70%",
  height: "37%",
  label: " Error ",
  content: "",
  border: { type: "line" },
  style: {
    border: { fg: "red" },
    fg: "white",
    label: {
      fg: "lightgrey",
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
  content: "",
  border: { type: "line" },
  style: {
    border: { fg: "blue" },
    fg: "white",
    label: {
      fg: "lightgrey",
    },
  },
  hidden: true,
});

const loading = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "shrink",
  height: "shrink",
  content: " Loading... ",
  border: { type: "none" },
  style: {
    border: { fg: "blue" },
    fg: "white",
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

feedList.setItems(["Loading..."]);

const loadAndDisplayIssues = async () => {
  try {
    loadingHandler(true);
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
        feedList.select(0);
        firstGPressed = false;
        screen.render();
      }
    }, 300);
  } else {
    feedList.select(0);
    firstGPressed = false;
    screen.render();
  }
});

screen.program.on("keypress", function (_ch, key) {
  if (key.name === "g" && key.shift) {
    feedList.select(feedList.items.length - 1);
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

screen.key("?", function () {
  if (helpBox.hidden) {
    data.helpOpen = true;
    screen.append(helpBox);
    helpBox.show();
    screen.render();
  }
});

screen.key("w", function () {
  if (data.commentsOpen) {
    data.commentsOpen = false;
    comments.hide();
    screen.render();
  }

  writeComments.setLabel(` ${data.currentIssue} [ESC for exit]`);
  writeComments.input("\n  Type a comment and hit enter", (_err, value) => {
    if (!value) return;
    infoHandler(value);
    jira.writeComments(data.currentIssue, value).then((result) => {
      infoHandler(`Comment ${result.body} was created`);
    });
  });
});

screen.key(["c"], (_ch, _key) => {
  screen.append(comments);
  data.commentsOpen = true;
  comments.show();
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

setInterval(() => {
  const selectedIndexMain = feedList.selected;
  if (selectedIndexMain !== undefined && data.issues[selectedIndexMain]) {
    data.currentIssue = data.issues[selectedIndexMain].key;
    description.setContent(
      `{bold}Issue:{/bold}{blue-fg}      ${data.issues[selectedIndexMain].key}{/blue-fg}\n` +
        `{bold}Assignee:{/bold}{blue-fg}   ${data.issues[selectedIndexMain].assignee}{/blue-fg}\n` +
        `{bold}Reporter:{/bold}{blue-fg}   ${data.issues[selectedIndexMain].reporter}{/blue-fg}\n` +
        `{bold}Status:{/bold}{blue-fg}     ${data.issues[selectedIndexMain].status}{/blue-fg}\n` +
        `{bold}Priority:{/bold}{blue-fg}   ${severity(data.issues[selectedIndexMain].severity)}{/blue-fg}\n` +
        `{bold}Watchers:{/bold}{blue-fg}   ${data.issues[selectedIndexMain].watchCount}{/blue-fg}\n` +
        `{bold}Labels:{/bold}{blue-fg}     ${data.issues[selectedIndexMain].labels.toString()}{/blue-fg}\n` +
        `{bold}DueDate:{/bold}{green-fg}    ${data.issues[selectedIndexMain].duedate}{/green-fg}\n` +
        `{bold}Created:{/bold}{green-fg}    ${data.issues[selectedIndexMain].created}{/green-fg}\n` +
        `{bold}LastUpdate:{/bold}{green-fg} ${data.issues[selectedIndexMain].lastUpdate}{/green-fg}\n\n` +
        `{bold}Description:{/bold}{blue-fg}\n\n${data.issues[selectedIndexMain].description || "No description available"}{/blue-fg}`,
    );
    description.setLabel(" Description (" + data.issues.length + ") Issues ");

    if (data.currentIssue !== "") {
      jira.getComments(data.currentIssue).then((value) => {
        const commentList = value.comments.map((item) => {
          return (
            `{bold}From:{/bold} ${item.author.displayName}\n` +
            `{blue-fg}${item.body}{/blue-fg}\n\n` +
            `{bold}Last update:{/bold} ${item.updated}\n\n`
          );
        });
        commentList.unshift(
          `{bold}{green-fg}> ${data.issues[selectedIndexMain].summary}{/green-fg}{/bold}\n\n`,
        );
        if (commentList.length === 1)
          commentList.push("{bold}No comments...{/bold}");

        comments.setLabel(`Comments for ${data.currentIssue} [quit width q]`);
        comments.setContent(commentList.join(""));
      });
    }
  }
  screen.render();
}, 600);
