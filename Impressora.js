function conectarImpressora() {

    if (typeof BrowserPrint === "undefined") {

        console.warn(
            "BrowserPrint não encontrado."
        );

        return;
    }

    BrowserPrint.getDefaultDevice(
        "printer",
        function(printer) {

            zebraPrinter = printer;

            console.log(
                "Impressora encontrada:",
                printer.name
            );

        },
        function(error) {

            console.error(error);

        }
    );
}