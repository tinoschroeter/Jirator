# Jirator

Jira TUI application, will not work with Jira Cloud.

## installation

### Get Access Token

Go to your profile <https://jira.example.com/secure/ViewProfile.jspa> and generate a Personal Access Tokens.

### ENV

```bash
export JIRA_HOST="jira.example.com"
export JIRA_API_TOKEN="123"
export JIRA_JQL_LIST='[["Issues CurrentUser","assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC"]]'
```

```bash
git clone git@github.com:tinoschroeter/Jirator.git
cd Jirator

npm install
npm install -g .

jirator
```

## Update

```bash
cd Jirator
git pull
```

## JQL filter

```js
[
  [
    "Issues CurrentUser",
    "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  ],
  [
    "Filter Quckwin List",
    "project = <PROJECT> AND assignee = <ASSIGNEE> AND status != Closed AND labels = quickwin",
  ],
  [
    "Watched issues",
    "watcher = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  ],
  [
    "Backlog List",
    "project = <PROJECT> AND assignee = <ASSIGNEE> AND status != Closed ORDER BY priority",
  ],
];
```

## Vim

```bash
vim.keymap.set("n", "<leader>j", function()
  Snacks.terminal.open({ "jirator", vim.api.nvim_buf_get_name(0) })
end, { desc = "Jira" })
```

## Links

- [Jira REST API v2](https://developer.atlassian.com/cloud/jira/platform/rest/v2/intro/#about)
