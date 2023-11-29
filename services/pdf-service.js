let ejs = require("ejs");
let pdf = require("html-pdf");
let path = require("path");


const buildPDF = (req,res) => {
    ejs.renderFile(path.join(__dirname, '../views', "template.ejs"), { containers: req.body }, (err, data) => {
        if (err) {
            res.send(err);
        } else {
            let options = {
                "height": "11.25in",
                "width": "8.5in",
                "header": {
                    "height": "20mm"
                },
                "footer": {
                    "height": "20mm",
                },
            };
            res.setHeader('Content-type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment;filename=container.pdf')
            pdf.create(data, options).toStream(function (err, stream) {
                if (err) {
                    console.log(err)
                }
                stream.pipe(res);
            });
        }
    });
}
module.exports = {
    buildPDF
}