const codeReader = new ZXing.BrowserMultiFormatReader();

let cameraAtiva = false;

async function toggleCamera() {

    const area =
        document.getElementById('camera-area');

    if (cameraAtiva) {

        codeReader.reset();

        area.style.display = 'none';

        cameraAtiva = false;

        return;
    }

    try {

        area.style.display = 'block';

        cameraAtiva = true;

        await codeReader.decodeFromVideoDevice(
            null,
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

                    area.style.display = 'none';

                    cameraAtiva = false;
                }

            }
        );

    } catch (err) {

        console.error(err);

        alert(
            'Não foi possível acessar a câmera.'
        );

    }

}

function trocarCamera() {
    // desativado por enquanto
}