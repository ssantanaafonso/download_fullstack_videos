const puppeteer = require('puppeteer');
const prompt = require('prompt');
const EOI_LOGIN = 'https://campus.eoi.es/';
const EOI_COLLAB = 'https://grabaciones-collab-eoi.edudevel.com/app/recordings';
const dotenv = require('dotenv');
const { default: axios } = require('axios');
const fs = require("fs");
dotenv.config();

(async () => {
    console.log("Abriendo web EOI...");
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
    });
    let page = await browser.newPage();
    await page.goto(EOI_LOGIN, {waitUntil: 'networkidle0'}); 
    await page.click('#agree_button');
    console.log("Introduce tu nombre de usuario y contraseña para acceder");
    //Esto era para pedir por el prompt usuario y contraseña
    // prompt.start();
    // const {username, password} = await prompt.get(['username', 'password']);
    const username = process.env.USER;
    const password = process.env.PASSWORD;
    console.log(username);
    console.log(password);

    await page.type('#user_id', username);
    await page.type('#password', password);

    console.log("Logueando al usuario");
    page.click('#entry-login');
    await page.waitForNavigation({waitUntil: 'networkidle0'});

    console.log("Dirigiendose a la página de fullstack");
    page.click('#_22_1termCourses_noterm > ul > li > a');
    await page.waitForNavigation({waitUntil: 'networkidle0'})

    console.log("Abriendo apartado de acceso a grabaciones");
    // page.click('span[title="Acceso a Grabaciones Videoconferencias"]');
    const newPagePromise = new Promise(x => page.once('popup', x));
    await page.evaluate(() => {
        document.querySelector('span[title="Acceso a Grabaciones Videoconferencias"]').parentElement.click();
        return true;
    })
    const newPage = await newPagePromise;
    await newPage.waitForNavigation({waitUntil: 'networkidle0'})

    //Evaluate solo puede devolver strings
    const videoLinksRaw = await newPage.evaluate(() => {

        let elements = Array.from(document.querySelectorAll("tr a"));
        const regex = /\W/gm;

        return links = elements.map(el => {
            return JSON.stringify({
                date: el.closest("tr").children[3].innerText.replace(regex, ''),
                url: el.href
            })
        })
    })
    //Por lo tanto aqui tengo que transformar esas string en array para manipular los bojetos más facilmente.
    const videoLinksFormated = videoLinksRaw.map(el => JSON.parse(el))

    // Recorremos la colección de enlaces para acceder a las distintas páginas e ir haciendo las descargas
    for (const videoLink of videoLinksFormated) {
        console.log(videoLink);
        let videoPage = await browser.newPage();
        await videoPage.goto(videoLink.url, {waitUntil: 'networkidle0'});
    
        const link = await videoPage.evaluate(() => {
            console.log(document.querySelector("video source").src);
            return document.querySelector("video source").src;
        })
        //Descargamos el video
        await downloadFile(link, `${process.env.VIDEO}\\${videoLink.date}.mp4`)
        await videoPage.close();
    }
})();

function downloadFile(url, outputLocationPath){
    // return axios({
    //     method: "get",
    //     url: url,
    //     responseType: "blob"
    // }).then(res => {
    //     fs.writeFile(outputLocationPath, res.data, err=> {
    //         if(err) console.log(err);
    //         console.log("Todo bien todo correcto, y yo que me alegrou");
    //     })
    // })
    const writer = fs.createWriteStream(`${outputLocationPath}`);
    
  return axios({
    method: 'get',
    url: url,
    responseType: 'stream',
  }).then(response => {

    //ensure that the user can call `then()` only when the file has
    //been downloaded entirely.

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on('close', () => {
        if (!error) {
          resolve(true);
        }
        //no need to call the reject here, as it will have been called in the
        //'error' stream;
      });
    });
  });
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }