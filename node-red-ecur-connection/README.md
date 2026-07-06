A deployer par dessus /root/.node-red/node_modules/@okonek83/node-red-ecur-connection/


Répare un problème de conversion de variables



If you have a solar array and you use APsystems inverters, in combination with their ECU-R device, these nodes will allow you to connect to the ECU and read the data from it, so that you can track the production of your solar panels.

Note: It is untested with other ECU devices.

As the API is not exposed on the wired LAN port, you will have to make sure your ECU is connected to your WiFi network, and that you give it a fixed IP address.

Use the `inverters-config` node to set the IP address and port (default port = 8899, you should not need to change this), then link the output of the config node to the `inverters query` node.
In order to trigger the data fetch, send a text payload of 'get' to the input of the config node. The query node will then output a JSON object with all relevant data. 


The example flow below is pretty self-explanatory. Just make sure you configure the correct IP address and you should be off to the races:

```

[
    {
        "id": "10c5b5cd91f08a21",
        "type": "inverters-query",
        "z": "cc59112a0cee767a",
        "x": 630,
        "y": 320,
        "wires": [
            [
                "95bce8b5fdc8f79a"
            ]
        ]
    },
    {
        "id": "854efba708da37ab",
        "type": "inverters-config",
        "z": "cc59112a0cee767a",
        "ip": "10.0.0.50",
        "port": "8899",
        "x": 410,
        "y": 320,
        "wires": [
            [
                "10c5b5cd91f08a21"
            ]
        ]
    },
    {
        "id": "17725379330ed1aa",
        "type": "inject",
        "z": "cc59112a0cee767a",
        "name": "",
        "props": [
            {
                "p": "payload"
            }
        ],
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "get",
        "payloadType": "str",
        "x": 190,
        "y": 320,
        "wires": [
            [
                "854efba708da37ab"
            ]
        ]
    },
    {
        "id": "95bce8b5fdc8f79a",
        "type": "debug",
        "z": "cc59112a0cee767a",
        "name": "ECU-R data",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "payload",
        "targetType": "msg",
        "statusVal": "",
        "statusType": "auto",
        "x": 870,
        "y": 320,
        "wires": []
    }
]

```

This set of nodes was created with massive influence from: 

https://github.com/rkokkelk/apsystems_ecur
and
https://github.com/ksheumaker/homeassistant-apsystems_ecur

A great thank you to the respective developers!
