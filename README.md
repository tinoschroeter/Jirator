# Jirator

Jira TUI application

## installation

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

## Vim

```bash
vim.keymap.set("n", "<leader>j", function()
  Snacks.terminal.open({ "jirator", vim.api.nvim_buf_get_name(0) })
end, { desc = "Jira" })
```

## Links

- [Jira REST API v2](https://developer.atlassian.com/cloud/jira/platform/rest/v2/intro/#about)
