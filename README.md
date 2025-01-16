# Jirator

Jira TUI application

## installation

### ENV

```bash
export JIRA_HOST="jira.example.com"
export JIRA_API_TOKEN="123"
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
