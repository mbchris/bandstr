# Problem inspection

**URL:**
https://bandstr.apps.4ki.app

**Behaviour**

* Desktop web version: Login page is displayed, login with OIDC Google/GitHub is working, redirection to main page works
* APK App version: Login page is displayed, login with OIDC Google/GitHub opens the browser, page is empty, no redirect back to the app

**Expected Behaviour**

* APK App Version: Login page of ODIC provider is shown, after login redirect to app and loading of main screen.

## APK: Debug  information

Debug Info
DEBUG_MODE=true
Native platform=true
Platform=android
Window origin=https://localhost
Window href=https://localhost/#/login?redirect=/
Route redirect=/
Route token=(absent)
Route mobileAuth=(unset)
Route error=(unset)
Redirect path=/
API_URL(raw)=https://bandstr.apps.4ki.app
API base=https://bandstr.apps.4ki.app
Auth URL=https://bandstr.apps.4ki.app/api/auth
MOBILE_CALLBACK_URL(raw)=org.capacitor.bndstr://localhost/login
Native app callback=org.capacitor.bndstr://localhost/#/login?redirect=%2F
Native bridge callback=https://bandstr.apps.4ki.app/api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F
Web callback=https://localhost/login
Social callback=org.capacitor.bndstr://localhost/#/login?redirect=%2F
User agent=Mozilla/5.0 (Linux; Android 16; Pixel 7a Build/CP1A.260305.018; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.119 Mobile Safari/537.36

Debug Output
[Session Probe]
window_origin=https://localhost
window_href=https://localhost/#/login?redirect=/
route_redirect_raw=/
redirect_path=/
social_callback=org.capacitor.bndstr://localhost/#/login?redirect=%2F
authClient.getSession.error=(none)
authClient.getSession.has_user=no
authClient.getSession.has_session=no
raw_get_session.url=https://bandstr.apps.4ki.app/api/auth/get-session
raw_get_session.status=200
raw_get_session.acao=(none)
raw_get_session.acac=(none)
raw_get_session.aceh=(none)
raw_get_session.set_auth_token=absent
raw_get_session.body=null
raw_get_session.url=/api/auth/get-session
raw_get_session.status=200
raw_get_session.acao=(none)
raw_get_session.acac=(none)
raw_get_session.aceh=(none)
raw_get_session.set_auth_token=absent
raw_get_session.body=<!DOCTYPE html><html><head><title></title><meta charset=utf-8><meta name=description content=""><meta name=format-detection content="telephone=no"><meta name=msapplication-tap-highlight content=no><meta name=viewport con...
duration_ms=202




## Server: docker logs

### Google OIDC login:

<-- GET /api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F
--> GET /api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F 200 1ms
10.0.1.6 - - [30/Mar/2026:06:22:17 +0000] "GET /api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F HTTP/1.1" 200 777 "-" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- POST /api/auth/sign-in/social
2026-03-30T06:22:17.565Z ERROR [Better Auth]: Invalid errorCallbackURL: org.capacitor.bndstr://localhost/#/login?redirect=%2F
--> POST /api/auth/sign-in/social 403 3ms
10.0.1.6 - - [30/Mar/2026:06:22:17 +0000] "POST /api/auth/sign-in/social HTTP/1.1" 403 74 "https://bandstr.apps.4ki.app/api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"


### GitHub OIDC Login




<-- GET /api/mobile-auth/start?provider=github&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F
--> GET /api/mobile-auth/start?provider=github&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F 200 1ms
10.0.1.6 - - [30/Mar/2026:06:23:22 +0000] "GET /api/mobile-auth/start?provider=github&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F HTTP/1.1" 200 778 "-" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- POST /api/auth/sign-in/social
2026-03-30T06:23:22.801Z ERROR [Better Auth]: Invalid errorCallbackURL: org.capacitor.bndstr://localhost/#/login?redirect=%2F
--> POST /api/auth/sign-in/social 403 2ms
10.0.1.6 - - [30/Mar/2026:06:23:22 +0000] "POST /api/auth/sign-in/social HTTP/1.1" 403 74 "https://bandstr.apps.4ki.app/api/mobile-auth/start?provider=github&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"


## Docker inspet

[
    {
        "Id": "d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4",
        "Created": "2026-03-29T21:36:01.216441832Z",
        "Path": "/docker-entrypoint.sh",
        "Args": [
            "/bin/sh",
            "-c",
            "sh -c \"node /app/packages/api/dist/db/migrate.js && node /app/packages/api/dist/index.js & nginx -g 'daemon off;'\""
        ],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 185339,
            "ExitCode": 0,
            "Error": "",
            "StartedAt": "2026-03-29T21:36:01.257964509Z",
            "FinishedAt": "0001-01-01T00:00:00Z"
        },
        "Image": "sha256:15d57afa1a9269591e1121dab84241d6a310acbdfc15a2680973f4a84ae2afe2",
        "ResolvConfPath": "/var/lib/docker/containers/d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4/resolv.conf",
        "HostnamePath": "/var/lib/docker/containers/d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4/hostname",
        "HostsPath": "/var/lib/docker/containers/d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4/hosts",
        "LogPath": "/var/lib/docker/containers/d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4/d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4-json.log",
        "Name": "/prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
        "RestartCount": 0,
        "Driver": "overlay2",
        "Platform": "linux",
        "MountLabel": "",
        "ProcessLabel": "",
        "AppArmorProfile": "docker-default",
        "ExecIDs": [
            "93c0dd60f96d47f356a6c5fd3937658e16a45dc7148ba62d5c25b13c4ff4b2ed"
        ],
        "HostConfig": {
            "Binds": null,
            "ContainerIDFile": "",
            "LogConfig": {
                "Type": "json-file",
                "Config": {
                    "max-file": "3",
                    "max-size": "10m"
                }
            },
            "NetworkMode": "bandstr-net",
            "PortBindings": {},
            "RestartPolicy": {
                "Name": "unless-stopped",
                "MaximumRetryCount": 0
            },
            "AutoRemove": false,
            "VolumeDriver": "",
            "VolumesFrom": null,
            "ConsoleSize": [
                0,
                0
            ],
            "CapAdd": null,
            "CapDrop": null,
            "CgroupnsMode": "private",
            "Dns": null,
            "DnsOptions": null,
            "DnsSearch": null,
            "ExtraHosts": [
                "host.docker.internal:host-gateway"
            ],
            "GroupAdd": null,
            "IpcMode": "private",
            "Cgroup": "",
            "Links": null,
            "OomScoreAdj": 0,
            "PidMode": "",
            "Privileged": false,
            "PublishAllPorts": false,
            "ReadonlyRootfs": false,
            "SecurityOpt": null,
            "UTSMode": "",
            "UsernsMode": "",
            "ShmSize": 67108864,
            "Runtime": "runc",
            "Isolation": "",
            "CpuShares": 0,
            "Memory": 0,
            "NanoCpus": 0,
            "CgroupParent": "",
            "BlkioWeight": 0,
            "BlkioWeightDevice": null,
            "BlkioDeviceReadBps": null,
            "BlkioDeviceWriteBps": null,
            "BlkioDeviceReadIOps": null,
            "BlkioDeviceWriteIOps": null,
            "CpuPeriod": 0,
            "CpuQuota": 0,
            "CpuRealtimePeriod": 0,
            "CpuRealtimeRuntime": 0,
            "CpusetCpus": "",
            "CpusetMems": "",
            "Devices": null,
            "DeviceCgroupRules": null,
            "DeviceRequests": null,
            "MemoryReservation": 0,
            "MemorySwap": 0,
            "MemorySwappiness": null,
            "OomKillDisable": null,
            "PidsLimit": null,
            "Ulimits": null,
            "CpuCount": 0,
            "CpuPercent": 0,
            "IOMaximumIOps": 0,
            "IOMaximumBandwidth": 0,
            "MaskedPaths": [
                "/proc/acpi",
                "/proc/asound",
                "/proc/interrupts",
                "/proc/kcore",
                "/proc/keys",
                "/proc/latency_stats",
                "/proc/sched_debug",
                "/proc/scsi",
                "/proc/timer_list",
                "/proc/timer_stats",
                "/sys/devices/virtual/powercap",
                "/sys/firmware"
            ],
            "ReadonlyPaths": [
                "/proc/bus",
                "/proc/fs",
                "/proc/irq",
                "/proc/sys",
                "/proc/sysrq-trigger"
            ]
        },
        "GraphDriver": {
            "Data": {
                "ID": "d739de3d6150c5c6f955760debd5c9dadef35cb9837d5ac48689503d96410ce4",
                "LowerDir": "/var/lib/docker/overlay2/d9c29fa7ad1e94407ddc3de4dfc0b021c9f923d656d2f9770065daa9c44b8f05-init/diff:/var/lib/docker/overlay2/xfeyt3jitrbsx4kpzvwra8hmc/diff:/var/lib/docker/overlay2/e9npn39hierju2mlqa5ypr2rk/diff:/var/lib/docker/overlay2/wzlj703zef8b3xbytadyk943f/diff:/var/lib/docker/overlay2/6mndhga2mx2v30dbugmhn31bh/diff:/var/lib/docker/overlay2/boovrvjpjgbw0eulafqhk0a4f/diff:/var/lib/docker/overlay2/va9p9x61pq4tgfpvmyyhu2m4u/diff:/var/lib/docker/overlay2/okp5d0on4jweol7tjn0tz521h/diff:/var/lib/docker/overlay2/qlpehs505zpl6flp7zvvjotto/diff:/var/lib/docker/overlay2/bjyw2zcfhu1w8jx0exwfgez2f/diff:/var/lib/docker/overlay2/7ff8nb8qfk8w9mp0qvs5tph5i/diff:/var/lib/docker/overlay2/mxpsawnhyyf45jwz4cpah16sa/diff:/var/lib/docker/overlay2/yit7bqqwzsptgpuuo5ill8dwg/diff:/var/lib/docker/overlay2/f401992ba2873a4bf332fceb214eeec1111f33774d93a0055d804eea52f24f44/diff:/var/lib/docker/overlay2/06d41509f9daee8cc37b3232974e4141ba1ab9d8694eea5214d55b6916a94ad8/diff:/var/lib/docker/overlay2/e30de1e7295b5e2fadac515b3a18919cdd4c27b0dfd57158b42664eee8805ded/diff:/var/lib/docker/overlay2/326f554ef0d98ad67d13e60b4dd2d5d56f9cd1193f5662b80fd8c7f3189fbd67/diff:/var/lib/docker/overlay2/50e83127edb72c7b206dc5f497a221d63dcb7e97bffb9ac4e8a957ce93024ab3/diff:/var/lib/docker/overlay2/241c37db5b3abcb0c570d3ec55e17daa02200059764f5fec8067d19deb47261d/diff:/var/lib/docker/overlay2/a5df65e882d7d462f66bd7bc1d2419ea9f27d6326a67bf9fe27d63e218482825/diff:/var/lib/docker/overlay2/07ea235823a74022e2eca3f17ca8e7fc3162d5bdcd7e161e71308eb91f8dd1c6/diff",
                "MergedDir": "/var/lib/docker/overlay2/d9c29fa7ad1e94407ddc3de4dfc0b021c9f923d656d2f9770065daa9c44b8f05/merged",
                "UpperDir": "/var/lib/docker/overlay2/d9c29fa7ad1e94407ddc3de4dfc0b021c9f923d656d2f9770065daa9c44b8f05/diff",
                "WorkDir": "/var/lib/docker/overlay2/d9c29fa7ad1e94407ddc3de4dfc0b021c9f923d656d2f9770065daa9c44b8f05/work"
            },
            "Name": "overlay2"
        },
        "Mounts": [],
        "Config": {
            "Hostname": "d739de3d6150",
            "Domainname": "",
            "User": "",
            "AttachStdin": false,
            "AttachStdout": true,
            "AttachStderr": true,
            "ExposedPorts": {
                "80/tcp": {}
            },
            "Tty": false,
            "OpenStdin": false,
            "StdinOnce": false,
            "Env": [
                "COOLIFY_CONTAINER_NAME=bandstr-prod",
                "AUTH_ORIGIN=https://bandstr.apps.4ki.app",
                "CORS_ORIGINS=https://localhost:9000,https://bandstr.apps.4ki.app,https://localhost",
                "SERVICE_URL_PROD=https://bandstr.apps.4ki.app",
                "NODE_ENV=production",
                "AUTH_TRUST_HOST=true",
                "INTERNAL_ADMIN_TOKEN=b8efb624-79f2-4934-9686-341220340e00",
                "SERVICE_FQDN_PROD=bandstr.apps.4ki.app",
                "bandstr_GIT_REV=UNKNOWN",
                "COOLIFY_RESOURCE_UUID=wlbdi7ezd2lom8m7o1i6y76x",
                "GH_PROJECT_OWNER=mbchris",
                "PORT=3001",
                "GHUB_CLIENT_ID=Ov23liHduFEXwAegIKy0",
                "SERVICE_URL_DEV=https://localhost",
                "SOURCE_COMMIT=UNKNOWN",
                "HOST=0.0.0.0",
                "COOLIFY_BRANCH=\"main\"",
                "APP_DOMAIN=bandstr.apps.4ki.app",
                "GIT_REV=UNKNOWN",
                "DEVMODE=false",
                "API_URL=https://bandstr.apps.4ki.app/api",
                "COOLIFY_URL=https://bandstr.apps.4ki.app",
                "GOOGLE_CLIENT_SECRET=xx",
                "SERVICE_FQDN_DEV=localhost",
                "GHUB_CLIENT_SECRET=xx",
                "DATABASE_URL=postgres://bandstr:xx@wmbya8t8ob6u4318xl0afd5o:5432/postgres",
                "SERVICE_NAME_DEV=dev",
                "COOLIFY_FQDN=bandstr.apps.4ki.app",
                "SERVICE_NAME_PROD=prod",
                "GOOGLE_CLIENT_ID=439175531087-i2v74mnnuhrnpjdbfndq7bun1mobj7p4.apps.googleusercontent.com",
                "AUTH_SECRET=xx",
                "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "NGINX_VERSION=1.27.5",
                "PKG_RELEASE=1",
                "DYNPKG_RELEASE=1",
                "NJS_VERSION=0.8.10",
                "NJS_RELEASE=1",
                "ENV=/etc/bandstr_shell_rc"
            ],
            "Cmd": [
                "/bin/sh",
                "-c",
                "sh -c \"node /app/packages/api/dist/db/migrate.js && node /app/packages/api/dist/index.js & nginx -g 'daemon off;'\""
            ],
            "Image": "bandstr-prod:UNKNOWN",
            "Volumes": null,
            "WorkingDir": "/app",
            "Entrypoint": [
                "/docker-entrypoint.sh"
            ],
            "Labels": {
                "caddy_0": "https://bandstr.apps.4ki.app",
                "caddy_0.encode": "zstd gzip",
                "caddy_0.handle_path": "/*",
                "caddy_0.handle_path.0_reverse_proxy": "{{upstreams}}",
                "caddy_0.header": "-Server",
                "caddy_0.try_files": "{path} /index.html /index.php",
                "caddy_ingress_network": "wlbdi7ezd2lom8m7o1i6y76x",
                "com.docker.compose.config-hash": "2f04ec8bc8d39643aa1e7686b7caac4509576fe7fe605e02e438808de5498567",
                "com.docker.compose.container-number": "1",
                "com.docker.compose.depends_on": "",
                "com.docker.compose.image": "sha256:15d57afa1a9269591e1121dab84241d6a310acbdfc15a2680973f4a84ae2afe2",
                "com.docker.compose.oneoff": "False",
                "com.docker.compose.project": "b3cqw7ig76loadc9apqghinw",
                "com.docker.compose.project.config_files": "/artifacts/b3cqw7ig76loadc9apqghinw/docker-compose.yml",
                "com.docker.compose.project.environment_file": "/artifacts/b3cqw7ig76loadc9apqghinw/.env",
                "com.docker.compose.project.working_dir": "/artifacts/b3cqw7ig76loadc9apqghinw",
                "com.docker.compose.service": "prod",
                "com.docker.compose.version": "2.38.2",
                "coolify.applicationId": "6",
                "coolify.environmentName": "production",
                "coolify.managed": "true",
                "coolify.name": "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                "coolify.projectName": "bandstr",
                "coolify.pullRequestId": "0",
                "coolify.resourceName": "bandstr-prod",
                "coolify.serviceName": "bandstr-prod",
                "coolify.type": "application",
                "coolify.version": "4.0.0-beta.468",
                "maintainer": "NGINX Docker Maintainers <docker-maint@nginx.com>",
                "org.opencontainers.image.revision": "UNKNOWN",
                "org.opencontainers.image.title": "bandstr-prod",
                "org.opencontainers.image.version": "UNKNOWN",
                "traefik.docker.network": "coolify",
                "traefik.enable": "true",
                "traefik.http.middlewares.gzip.compress": "true",
                "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme": "https",
                "traefik.http.routers.bandstr-prod.entrypoints": "https",
                "traefik.http.routers.bandstr-prod.rule": "Host(`${APP_DOMAIN:-bandstr.trmusic.de}`)",
                "traefik.http.routers.bandstr-prod.tls": "true",
                "traefik.http.routers.bandstr-prod.tls.certresolver": "letsencrypt",
                "traefik.http.routers.http-0-wlbdi7ezd2lom8m7o1i6y76x-prod.entryPoints": "http",
                "traefik.http.routers.http-0-wlbdi7ezd2lom8m7o1i6y76x-prod.middlewares": "redirect-to-https",
                "traefik.http.routers.http-0-wlbdi7ezd2lom8m7o1i6y76x-prod.rule": "Host(`bandstr.apps.4ki.app`) && PathPrefix(`/`)",
                "traefik.http.routers.https-0-wlbdi7ezd2lom8m7o1i6y76x-prod.entryPoints": "https",
                "traefik.http.routers.https-0-wlbdi7ezd2lom8m7o1i6y76x-prod.middlewares": "gzip",
                "traefik.http.routers.https-0-wlbdi7ezd2lom8m7o1i6y76x-prod.rule": "Host(`bandstr.apps.4ki.app`) && PathPrefix(`/`)",
                "traefik.http.routers.https-0-wlbdi7ezd2lom8m7o1i6y76x-prod.tls": "true",
                "traefik.http.routers.https-0-wlbdi7ezd2lom8m7o1i6y76x-prod.tls.certresolver": "letsencrypt",
                "traefik.http.services.bandstr-prod.loadbalancer.server.port": "80"
            },
            "StopSignal": "SIGQUIT"
        },
        "NetworkSettings": {
            "SandboxID": "226e68b60b8ab1f42fe7de1fd0d4574c5db93ea2693e1ec8e4d67f159b6cf5f7",
            "SandboxKey": "/var/run/docker/netns/226e68b60b8a",
            "Ports": {
                "80/tcp": null
            },
            "Networks": {
                "bandstr-net": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                        "prod"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "e333f804dd208ab876681c37109694170ae85d217a6ab46737888cd85226b335",
                    "EndpointID": "58b21cf85160a5e4a217bfc3b2d4da42b1b884ef7fc771d5cf416ac4dbe3626b",
                    "Gateway": "10.0.10.1",
                    "IPAddress": "10.0.10.2",
                    "MacAddress": "d6:60:5a:25:ac:ce",
                    "IPPrefixLen": 24,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                        "prod",
                        "d739de3d6150"
                    ]
                },
                "coolify": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                        "prod"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "a6e8fe6ebd39dc1739127b6efca84471e170c74e925db92c5f5ea8fdae6a557e",
                    "EndpointID": "7dd40c882b5df4c983c985a61bf70aa253397483869d407d555fa00a5cec5149",
                    "Gateway": "10.0.1.1",
                    "IPAddress": "10.0.1.13",
                    "MacAddress": "2a:30:ad:ec:0a:9f",
                    "IPPrefixLen": 24,
                    "IPv6Gateway": "fdbe:c731:a34::1",
                    "GlobalIPv6Address": "fdbe:c731:a34::d",
                    "GlobalIPv6PrefixLen": 64,
                    "DNSNames": [
                        "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                        "prod",
                        "d739de3d6150"
                    ]
                },
                "wlbdi7ezd2lom8m7o1i6y76x": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": [
                        "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                        "prod"
                    ],
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "2ea1f3d934403d3c60045b11b2e9745dade4182d92b62123a79f76b046450950",
                    "EndpointID": "943848593a4f3340900758fc968a698a9488c142373f14e7b051b031a46e51c7",
                    "Gateway": "10.0.9.1",
                    "IPAddress": "10.0.9.3",
                    "MacAddress": "e6:7e:56:cb:ae:22",
                    "IPPrefixLen": 24,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": [
                        "prod-wlbdi7ezd2lom8m7o1i6y76x-213527429354",
                        "prod",
                        "d739de3d6150"
                    ]
                }
            }
        }
    }
]




# Update 01 after applying fix

Applied suggestion from "claude --resume c4f89a8c-7dd1-42bc-a385-ece81fcebfab"

**Behaviour**

* Login page is shown. redirect is not happening. It stays in the browser.
* Note that earlier, there was an issue with when NOT using custom-scheme URL as errorCallbackURL. The app opened in the browser instead.  So I assume
  that  The the custom deep-link scheme (org.capacitor.bandstr://...)   should fix that as it was working earlier prior to a refactoring to a new repo.


Serverside log is:

--> GET /api/auth/get-session 200 2ms
10.0.1.6 - - [30/Mar/2026:06:36:40 +0000] "GET /api/auth/get-session HTTP/1.1" 200 4 "https://localhost/" "Mozilla/5.0 (Linux; Android 16; Pixel 7a Build/CP1A.260305.018; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.119 Mobile Safari/537.36" "93.206.43.60"
<-- GET /api/auth/get-session
--> GET /api/auth/get-session 200 5ms
10.0.1.6 - - [30/Mar/2026:06:36:40 +0000] "GET /api/auth/get-session HTTP/1.1" 200 4 "https://localhost/" "Mozilla/5.0 (Linux; Android 16; Pixel 7a Build/CP1A.260305.018; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.119 Mobile Safari/537.36" "93.206.43.60"
--> GET /api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F 302 4ms
10.0.1.6 - - [30/Mar/2026:06:37:43 +0000] "GET /api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F HTTP/1.1" 302 5 "-" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- GET /api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F
--> GET /api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F 200 2ms
10.0.1.6 - - [30/Mar/2026:06:36:48 +0000] "GET /api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F HTTP/1.1" 200 790 "-" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- POST /api/auth/sign-in/social
--> POST /api/auth/sign-in/social 200 33ms
10.0.1.6 - - [30/Mar/2026:06:36:48 +0000] "POST /api/auth/sign-in/social HTTP/1.1" 200 434 "https://bandstr.apps.4ki.app/api/mobile-auth/start?provider=google&callbackURL=https%3A%2F%2Fbandstr.apps.4ki.app%2Fapi%2Fmobile-auth%2Fcomplete%3FappCallbackURL%3Dorg.capacitor.bndstr%253A%252F%252Flocalhost%252F%2523%252Flogin%253Fredirect%253D%25252F&errorCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/callback/google?state=GurgLis1wJuT-wha4jEG2KGTeSPmP90V&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8D80V6H1dWign22HdCAJU3iiR94fA7vb5SQjokNO8kHpr2hd3Xr6gfc0h9sHLLxA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=0&prompt=none
--> GET /api/auth/callback/google?state=GurgLis1wJuT-wha4jEG2KGTeSPmP90V&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8D80V6H1dWign22HdCAJU3iiR94fA7vb5SQjokNO8kHpr2hd3Xr6gfc0h9sHLLxA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=0&prompt=none 302 179ms
10.0.1.6 - - [30/Mar/2026:06:37:34 +0000] "GET /api/auth/callback/google?state=GurgLis1wJuT-wha4jEG2KGTeSPmP90V&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8D80V6H1dWign22HdCAJU3iiR94fA7vb5SQjokNO8kHpr2hd3Xr6gfc0h9sHLLxA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=0&prompt=none HTTP/1.1" 302 5 "https://accounts.google.com/" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- GET /api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F
[mobile-auth/complete] token issued, redirecting to app callback
--> GET /api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F 302 5ms
10.0.1.6 - - [30/Mar/2026:06:37:34 +0000] "GET /api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F HTTP/1.1" 302 5 "https://accounts.google.com/" "Mozilla/5.0 (Android 16; Mobile; rv:149.0) Gecko/149.0 Firefox/149.0" "93.206.43.60"
<-- GET /api/mobile-auth/complete?appCallbackURL=org.capacitor.bndstr%3A%2F%2Flocalhost%2F%23%2Flogin%3Fredirect%3D%252F
[mobile-auth/complete] token issued, redirecting to app callback


# Update 02 after some other deployment.

A "logout" feature has been implemented to invalidate the token.
If another login is performed, there is no more redirect to the app.
The OIDC auth provder page opens.
Redirect stays on browser side.

Redirected URL is:
https://bandstr.apps.4ki.app/api/auth/callback/google?state=T0u6_BftM5AQoM-M4aFGax0tz6C904CA&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8zTbkm9iQtst0nl3wvERXBtN9oxzPK2ZwIbAlxmKqiaVsbwNURnngMDLh1GtRHsA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=0&prompt=none

From the web UI:
https://bandstr.apps.4ki.app/api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8uM17Lf-8VnJyak6qoiqY5gby6RF97FwnvozwlvsXYjj-6zFVMW00lUKJil3Ktrw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=2&prompt=none

it says for the web UI: "Looks like there’s a problem with this site

Firefox can’t connect to the server at bandstr.apps.4ki.app
What can you do about it?

The site could be temporarily unavailable or too busy. Try again in a few moments.
"

Docker Log state:

10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /api/auth/get-session HTTP/1.1" 200 4 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/AuthLayout-IB-a-RTe.js HTTP/1.1" 200 811 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/QPage-BK2j87JY.js HTTP/1.1" 200 896 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/QLayout-CPxZieds.js HTTP/1.1" 200 3758 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/AuthLayout-BV5WFN0t.css HTTP/1.1" 200 526 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/LoginPage-DMvYbaq1.js HTTP/1.1" 200 4435 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/QSpace-UPjd7QG1.js HTTP/1.1" 200 141 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/useI18n-D5twcTjN.js HTTP/1.1" 200 7171 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/LoginPage-CekmyMxn.css HTTP/1.1" 200 495 "https://bandstr.apps.4ki.app/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/rehearsal_dyn_v2.mp4 HTTP/1.1" 206 3787648 "https://bandstr.apps.4ki.app/login?redirect=/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/rehearsal_dyn_v2.mp4 HTTP/1.1" 206 28616 "https://bandstr.apps.4ki.app/login?redirect=/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:17:30 +0000] "GET /assets/rehearsal_dyn_v2.mp4 HTTP/1.1" 206 3928008 "https://bandstr.apps.4ki.app/login?redirect=/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- POST /api/auth/sign-in/social
--> POST /api/auth/sign-in/social 200 15ms
10.0.1.6 - - [30/Mar/2026:09:17:32 +0000] "POST /api/auth/sign-in/social HTTP/1.1" 200 433 "https://bandstr.apps.4ki.app/login?redirect=/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8uM17Lf-8VnJyak6qoiqY5gby6RF97FwnvozwlvsXYjj-6zFVMW00lUKJil3Ktrw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=2&prompt=none
2026-03-30T09:17:37.162Z ERROR [Better Auth]: Error Error: Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.
    at _serialize (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:55:34)
    at serializeSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:79:9)
    at async Object.setSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/context.mjs:57:19)
    at async setSessionCookie (file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/cookies/index.mjs:128:2)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/routes/callback.mjs:164:2
    at async internalHandler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/endpoint.mjs:30:20)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:72:21
    at async processRequest (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:83:11)
    at async handler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:106:16)
    at async file:///app/node_modules/.pnpm/@better-auth+core@1.5.6_@better-auth+utils@0.3.1_@better-fetch+fetch@1.1.21_@openteleme_ff474e0f73c5d4511fe48692fe38115a/node_modules/@better-auth/core/dist/context/transaction.mjs:37:13
# SERVER_ERROR:  Error: Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.
    at _serialize (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:55:34)
    at serializeSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:79:9)
    at async Object.setSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/context.mjs:57:19)
    at async setSessionCookie (file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/cookies/index.mjs:128:2)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/routes/callback.mjs:164:2
    at async internalHandler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/endpoint.mjs:30:20)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:72:21
    at async processRequest (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:83:11)
    at async handler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:106:16)
    at async file:///app/node_modules/.pnpm/@better-auth+core@1.5.6_@better-auth+utils@0.3.1_@better-fetch+fetch@1.1.21_@openteleme_ff474e0f73c5d4511fe48692fe38115a/node_modules/@better-auth/core/dist/context/transaction.mjs:37:13
--> GET /api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8uM17Lf-8VnJyak6qoiqY5gby6RF97FwnvozwlvsXYjj-6zFVMW00lUKJil3Ktrw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=2&prompt=none 500 118ms
10.0.1.6 - - [30/Mar/2026:09:17:37 +0000] "GET /api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8uM17Lf-8VnJyak6qoiqY5gby6RF97FwnvozwlvsXYjj-6zFVMW00lUKJil3Ktrw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&authuser=2&prompt=none HTTP/1.1" 500 5 "https://accounts.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8g90i1p3QBZt_wfhUMzFt7w75owjjydcQOcbKwtTXeRtGt0O31lxRbRSiK2klDXw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=2&prompt=none
2026-03-30T09:18:01.572Z ERROR [Better Auth]: Failed to parse state [StateError [BetterAuthError]: State mismatch: verification not found] {
  code: 'state_mismatch',
  details: { state: 'LuZ5za23UNOvylaQjwigmlLV0JlEjnxc' }
}
--> GET /api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8g90i1p3QBZt_wfhUMzFt7w75owjjydcQOcbKwtTXeRtGt0O31lxRbRSiK2klDXw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=2&prompt=none 302 12ms
10.0.1.6 - - [30/Mar/2026:09:18:01 +0000] "GET /api/auth/callback/google?state=LuZ5za23UNOvylaQjwigmlLV0JlEjnxc&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E8g90i1p3QBZt_wfhUMzFt7w75owjjydcQOcbKwtTXeRtGt0O31lxRbRSiK2klDXw&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid&authuser=2&prompt=none HTTP/1.1" 302 5 "https://accounts.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/error?error=please_restart_the_process
--> GET /api/auth/error?error=please_restart_the_process 302 3ms
10.0.1.6 - - [30/Mar/2026:09:18:01 +0000] "GET /api/auth/error?error=please_restart_the_process HTTP/1.1" 302 5 "https://accounts.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:18:01 +0000] "GET /?error=please_restart_the_process HTTP/1.1" 200 511 "https://accounts.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/get-session
--> GET /api/auth/get-session 200 2ms
10.0.1.6 - - [30/Mar/2026:09:18:01 +0000] "GET /api/auth/get-session HTTP/1.1" 200 4 "https://bandstr.apps.4ki.app/?error=please_restart_the_process" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/get-session
--> GET /api/auth/get-session 200 3ms
10.0.1.6 - - [30/Mar/2026:09:18:01 +0000] "GET /api/auth/get-session HTTP/1.1" 200 4 "https://bandstr.apps.4ki.app/?error=please_restart_the_process" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:18:02 +0000] "GET /assets/rehearsal_dyn_v2.mp4 HTTP/1.1" 206 3993544 "https://bandstr.apps.4ki.app/login?redirect=/?error=please_restart_the_process" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:18:02 +0000] "GET /assets/rehearsal_dyn_v2.mp4 HTTP/1.1" 206 28616 "https://bandstr.apps.4ki.app/login?redirect=/?error=please_restart_the_process" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
10.0.1.6 - - [30/Mar/2026:09:18:02 +0000] "GET /assets/rehearsal_dyn_v2.mp4 HTTP/1.1" 206 3960776 "https://bandstr.apps.4ki.app/login?redirect=/?error=please_restart_the_process" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- POST /api/auth/sign-in/social
--> POST /api/auth/sign-in/social 200 13ms
10.0.1.6 - - [30/Mar/2026:09:18:04 +0000] "POST /api/auth/sign-in/social HTTP/1.1" 200 433 "https://bandstr.apps.4ki.app/login?redirect=/?error=please_restart_the_process" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
<-- GET /api/auth/callback/google?state=odlopW1yr39_bWyrO5gKnOVfIfs_N0Sm&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E-b7tEMLA2jV93ZN5pW5EaHW7vL2LC5XFTjuiw7ru6xHgB65bICNONs9WzcwzsonA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&authuser=2&prompt=none
--> GET /api/auth/callback/google?state=odlopW1yr39_bWyrO5gKnOVfIfs_N0Sm&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E-b7tEMLA2jV93ZN5pW5EaHW7vL2LC5XFTjuiw7ru6xHgB65bICNONs9WzcwzsonA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&authuser=2&prompt=none 500 103ms
2026-03-30T09:18:08.281Z ERROR [Better Auth]: Error Error: Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.
    at _serialize (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:55:34)
    at serializeSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:79:9)
    at async Object.setSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/context.mjs:57:19)
    at async setSessionCookie (file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/cookies/index.mjs:128:2)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/routes/callback.mjs:164:2
10.0.1.6 - - [30/Mar/2026:09:18:08 +0000] "GET /api/auth/callback/google?state=odlopW1yr39_bWyrO5gKnOVfIfs_N0Sm&iss=https%3A%2F%2Faccounts.google.com&code=4%2F0Aci98E-b7tEMLA2jV93ZN5pW5EaHW7vL2LC5XFTjuiw7ru6xHgB65bICNONs9WzcwzsonA&scope=email+profile+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile&authuser=2&prompt=none HTTP/1.1" 500 5 "https://accounts.google.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:149.0) Gecko/20100101 Firefox/149.0" "93.206.43.60"
    at async internalHandler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/endpoint.mjs:30:20)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:72:21
    at async processRequest (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:83:11)
    at async handler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:106:16)
    at async file:///app/node_modules/.pnpm/@better-auth+core@1.5.6_@better-auth+utils@0.3.1_@better-fetch+fetch@1.1.21_@openteleme_ff474e0f73c5d4511fe48692fe38115a/node_modules/@better-auth/core/dist/context/transaction.mjs:37:13
# SERVER_ERROR:  Error: Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.
    at _serialize (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:55:34)
    at serializeSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/cookies.mjs:79:9)
    at async Object.setSignedCookie (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/context.mjs:57:19)
    at async setSessionCookie (file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/cookies/index.mjs:128:2)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/routes/callback.mjs:164:2
    at async internalHandler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/endpoint.mjs:30:20)
    at async file:///app/node_modules/.pnpm/better-auth@1.5.6_@opentelemetry+api@1.9.1_better-sqlite3@9.6.0_drizzle-kit@0.31.10_dri_227178a40192a82b6f550a648121fe8f/node_modules/better-auth/dist/api/to-auth-endpoints.mjs:72:21
    at async processRequest (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:83:11)
    at async handler (file:///app/node_modules/.pnpm/better-call@1.3.2_zod@4.3.6/node_modules/better-call/dist/router.mjs:106:16)
    at async file:///app/node_modules/.pnpm/@better-auth+core@1.5.6_@better-auth+utils@0.3.1_@better-fetch+fetch@1.1.21_@openteleme_ff474e0f73c5d4511fe48692fe38115a/node_modules/@better-auth/core/dist/context/transaction.mjs:37:13
	
	