- leafer 文档 https://deepwiki.com/leaferjs/leafer-ui
- 绝对禁止使用 any ，或者是为了解决类型错误而使用 as
- 每次实现一个功能都创建一个分支来实现，分支名为  yymmdd_功能简称(中文)
    - 实现功能完毕后由我 review 确定没问题后你再 commit 以及合并到 main 分支
    - 合并时必须使用 `git merge 功能分支 --no-ff --no-edit` 来创建 merge commit，保留分支历史
    - 开始下一个功能开发时记得要 push 功能分支，不要删除功能分支
[](./架构文档.md)