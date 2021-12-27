Accessible on github pages [here](https://mltucker.github.io/autoTEI/). Source code [here](https://github.com/mltucker/autoTEI/).

# Building

```bash
 # grab dependencies (first build)
yarn install

# build out/autoTEI.js
yarn build
```

# Docx parsing

I made a few changes to mammoth.js. Changes are on [github](https://github.com/mltucker/mammoth.js).

```bash
# The built mammoth.browser.js must be copied to the vendor/ directory
git clone https://github.com/mltucker/mammoth.js
cd mammoth.js
make setup
cp mammoth.browser.js ../autoTEI/vendor
```
