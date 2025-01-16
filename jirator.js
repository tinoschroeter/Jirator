#!/usr/bin/env node

const blessed = require("blessed");
const open = require("open");
const FETCH_TIMEOUT = 5_000; // 5 Seconds Timeout

const data = {
  currentIssue: "",
  issues: [],
  commentsOpen: false,
  helpOpen: false,
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
}

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

const prompt = blessed.prompt({
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
  keys: true,
  hidden: true,
});

const helpBox = blessed.box({
  parent: screen,
  top: "center",
  left: "center",
  width: "50%",
  height: "37%",
  label: " Help ",
  content: `q|Esc          Close Jirator 
/              Search
j              Move down in the list
k              Move up in the list
stg-j          Move down Description
stg-k          Move up Description
c              Open comments for the current issue
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

screen.append(feedList);
screen.append(description);
screen.append(prompt);
screen.append(comments);

feedList.setItems(["Loading..."]);

const loadAndDisplayIssues = async () => {
  try {
    const response = await jira.searchIssues(
      "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
    );
    const items = response.issues.map((item, index) => {
      data.issues.push({
        key: item.key,
        headline: item.fields.summary,
        lastUpdate: item.fields.updated,
        watchCount: item.fields.watches.watchCount,
        status: item.fields.status.name,
        severity: item.fields.priority.name,
        summary: item.fields.summary,
        description: item.fields.description,
      });
      return `[${item.key}] ${item.fields.summary}`;
    });

    feedList.setItems(items);
    screen.render();
  } catch (error) {
    let message = "";
    if (error.name === "AbortError") {
      message = "API request timed out ";
    }
    errorHandling(message + error.message);
  }
};

loadAndDisplayIssues();

screen.key("/", () => {
  prompt.input("", (_err, value) => {
    searchInList(value || "...");
  });
});

screen.key(["j"], (_ch, _key) => {
  feedList.down();
  screen.render();
});

screen.key(["k"], (_ch, _key) => {
  feedList.up();
  screen.render();
});

screen.key(["S-j"], (_ch, _key) => {
  description.scroll(20);
  screen.render();
});

screen.key(["S-k"], (_ch, _key) => {
  description.scroll(-20);
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

screen.key(["c"], (_ch, _key) => {
  screen.append(comments);
  data.commentsOpen = true;
  comments.show();
});

screen.key(["escape", "q"], (_ch, _key) => {
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
  const selectedIndex = feedList.selected;
  if (selectedIndex !== undefined && data.issues[selectedIndex]) {
    data.currentIssue = data.issues[selectedIndex].key;
    description.setContent(
      `{bold}Issue:{/bold} {blue-fg}${data.issues[selectedIndex].key}{/blue-fg}\n` +
        `{bold}Status:{/bold} ${data.issues[selectedIndex].status}\n` +
        `{bold}Priority:{/bold} ${severity(data.issues[selectedIndex].severity)}\n` +
        `{bold}Watchers:{/bold} ${data.issues[selectedIndex].watchCount}\n` +
        `{bold}lastUpdate:{/bold} {green-fg}${data.issues[selectedIndex].lastUpdate}{/green-fg}\n\n` +
        `{bold}Description:{/bold}\n{blue-fg}${data.issues[selectedIndex].description || "No description available"}{/blue-fg}`,
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
          `{bold}{green-fg}${data.issues[selectedIndex].summary}{/green-fg}{/bold}\n\n`,
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
