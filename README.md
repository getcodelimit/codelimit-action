# codelimit-action

[![Checked with Code Limit](https://github.com/getcodelimit/codelimit-action/blob/_codelimit_reports/main/badge.svg)](https://github.com/getcodelimit/codelimit)

To run Code Limit on every push and before every merge to main, append it to your GH Action workflow:

```yaml
name: 'main'
on:
  push:
    branches: 
      - main
  pull_request:
    branches: 
      - main
  jobs:
    ci:
      runs-on: ubuntu-latest
      steps:
        - name: 'Checkout sources'
          uses: actions/checkout@v4
        - name: 'Run Code Limit'
          uses: getcodelimit/codelimit-action@main
```

## Upload report

To upload the report to Code Limit, add the following step to your workflow:

```yaml
        - name: 'Run Code Limit'
          uses: getcodelimit/codelimit-action@main
          with:
            upload: true
            token: ${{ secrets.GITHUB_TOKEN }}
```
