const codeReader = new ZXing.BrowserMultiFormatReader();

let cameraAtiva = false;
let dispositivoAtual = null;

async function toggleCamera() {

    const area = document.getElementById('camera-area');

    if (cameraAtiva) {

        codeReader.reset();

        area.style.display = 'none';

        cameraAtiva = false;

        return;
    }

    try {

        const devices =
            await ZXing.BrowserCodeReader.listVideoInputDevices();

        const select =
            document.getElementById('camera-select');

        select.innerHTML = '';

        devices.forEach(device => {

            const option =
                document.createElement('option');

            option.value = device.deviceId;
            option.text =
                device.label ||
                `Câmera ${select.length + 1}`;

            select.appendChild(option);

        });

        dispositivoAtual =
            devices[0].deviceId;

        area.style.display = 'block';

        iniciarLeitura();

        cameraAtiva = true;

    } catch (err) {

        console.error(err);

        alert(
            'Erro ao acessar a câmera.'
        );

    }
}

async function trocarCamera() {

    dispositivoAtual =
        document.getElementById('camera-select')
        .value;

    codeReader.reset();

    iniciarLeitura();
}

function iniciarLeitura() {

    codeReader.decodeFromVideoDevice(
        dispositivoAtual,
        'camera-video',
        (result, err) => {

            if (result) {

                const codigo =
                    result.getText();

                document.getElementById(
                    'scan-input'
                ).value = codigo;

                buscarCodigo();

                codeReader.reset();

                document.getElementById(
                    'camera-area'
                ).style.display = 'none';

                cameraAtiva = false;
            }

        }
    );
}