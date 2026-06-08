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

let leitorCadastro = null;

async function abrirCameraCadastro() {

    try {

        const area =
            document.getElementById(
                'camera-cadastro-area'
            );

        area.style.display = 'block';

        leitorCadastro =
            new ZXing.BrowserMultiFormatReader();

        await leitorCadastro.decodeFromVideoDevice(
            null,
            'camera-cadastro-video',
            (result) => {

                if (result) {

                    document.getElementById(
                        'cad-codigo'
                    ).value = result.getText();

                    leitorCadastro.reset();

                    area.style.display = 'none';
                }
            }
        );

    } catch (err) {

        console.error(err);

        alert(
            'Erro ao abrir câmera.'
        );
    }
}
