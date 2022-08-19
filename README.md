# https-proxy
A https proxy server powered by deno

## How to use

### Require Deno
If you have deno. This is 2 way to use proxy server.
#### 1. direct run script by GitHub raw url
```shell
deno run --unstable --allow-net --allow-read https://raw.githubusercontent.com/skyyangyun/https-proxy/main/proxy.js
```

#### 2. install script to system
install:
```shell
deno install --unstable --allow-net --allow-read https://raw.githubusercontent.com/skyyangyun/https-proxy/main/proxy.js
```

run locally:
```shell
proxy
```


### Not requirement need
download releases package on the right

run program:
```shell
proxy
```
proxy address would print to console like this:
```shell
Listening on http://:::8000/
```

## HTTPS mode
By default, proxy server run in HTTP mode. To use HTTPS mode, you need use two flag:
`--certFile=<certFilePath>` and `--keyFile=<keyFilePath>`

example:
```shell
proxy --cert=./.acme.sh/yangyun.name/fullchain.cer --key=./.acme.sh/yangyun.name/yangyun.name.key
```

## Proxy Basic Authorization
To use basic authorization, you need assign `--auth=<authFilePath>` flag,
you can check this repository `authorization` file for example.

```shell
proxy --auth=./authorization
```

loaded valid user number would print when program boot.
```
Listening on http://:::8000/
[Warning] pass basic authorization on HTTP is unsafely, please consider use HTTPS
load 0 valid user
```
