const puppeteer = require('puppeteer');
const prompt = require('prompt');
const EOI_LOGIN = 'https://campus.eoi.es/';
const EOI_COLLAB = 'https://grabaciones-collab-eoi.edudevel.com/app/recordings';
const dotenv = require('dotenv');
const { default: axios } = require('axios');
const fs = require("fs");
dotenv.config();
let rawdata = fs.readFileSync('classes.json');
let classes = JSON.parse(rawdata);
(async () => {
    prompt.start();
    console.log("Abriendo web EOI...");
    const browser = await puppeteer.launch();
    let page = await browser.newPage();
    await page.goto(EOI_LOGIN, {waitUntil: 'networkidle0'}); 
    await page.click('#agree_button');
    console.log("Introduce tu nombre de usuario y contraseña para acceder");
    // Pedimos el prompt usuario y contraseña
    
    const {username, password} = await prompt.get(['username', 'password']);

    await page.type('#user_id', username);
    await page.type('#password', password);

    console.log("Logueando al usuario");
    page.click('#entry-login');
    await page.waitForNavigation({waitUntil: 'networkidle0'});

    console.log("Dirigiendose a la página de fullstack");
    page.click('#_22_1termCourses_noterm > ul > li > a');
    await page.waitForNavigation({waitUntil: 'networkidle0'})

    console.log("Abriendo apartado de acceso a grabaciones");
    const newPagePromise = new Promise(x => page.once('popup', x));
    await page.evaluate(() => {
        document.querySelector('span[title="Acceso a Grabaciones Videoconferencias"]').parentElement.click();
        return true;
    })
    const newPage = await newPagePromise;
    await newPage.waitForNavigation({waitUntil: 'networkidle0'})

    //Ruta donde quieres guardar los archivos
    console.log("Elige la ruta donde quieres guardar los archivos. Para rutas en windows debes usar \\\\.");
    console.log("Por ejemplo en vez de C:\\Users deberías introducir C:\\\\Users");
    const {path} = await prompt.get(['path']);
    console.log("Cargando páginas de descarga...");
    //Evaluate solo puede devolver strings
    const videoLinksRaw = await newPage.evaluate(() => {

        let elements = Array.from(document.querySelectorAll("tr a"));

        return links = elements.map(el => {
          const date = el.closest("tr").children[3].innerText
            return JSON.stringify({
                date: date,
                url: el.href
            })
        })
    })
    //Por lo tanto aqui tengo que transformar esas string en array para manipular los objetos más facilmente.
    const videoLinksFormated = videoLinksRaw.map(el => JSON.parse(el))

    // Recorremos la colección de enlaces para acceder a las distintas páginas e ir haciendo las descargas
    let i = 0;
    for (const videoLink of videoLinksFormated) {
        i++;
        let videoPage = await browser.newPage();
        await videoPage.goto(videoLink.url, {timeout:0, waitUntil: 'networkidle0'});
        await videoPage.waitForSelector("video", {visible:true});
        const link = await videoPage.evaluate(() => {
            let test = document.querySelector("video").src;
            //Parece que la eoi ha actualizado el collab y ahora tienen tipos de páginas mezcladas, por eso hay que hacer 2 comprobaciones.
            if(test == ""){
              return document.querySelector("video source").src
            }else{
              return test
            } 
        })
        console.log(`Descargando video: ${i} de ${videoLinksFormated.length}`);
        console.log(`---------------------------------------------------------------------------------------------------------------`);
        //Sacamos del fichero classes.json los titulos de los videos
        const videoTitle = getVideoTitle(videoLink.date)
        //Descargamos el video
        await downloadFile(link, `${path}\\${videoTitle}.mp4`);
        await videoPage.close();
    }
})();

function downloadFile(url, outputLocationPath){
  const writer = fs.createWriteStream(`${outputLocationPath}`);
  return axios({
    method: 'get',
    url: url,
    responseType: 'stream',
    
  })
  .then(response => {
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

  function getVideoTitle(date){
    const regex = /\W/gm;
    date = date.replace(regex, " ").split(" ");
    const day = date[0];
    const month =date[1];
    const year = date[2];
    const time = `${date[3]}${date[4]}`;
    const videoDate = parseInt(`${year}${month}${day}`)
    const semana = classes.find(week => {
      const startDate = parseInt(week.start_Date);
      const endDate = parseInt(week.end_Date);
      return videoDate >= startDate && videoDate <= endDate;
    });
    let diaVideo;
    if(!semana.name == "Semana_proyecto"){
      diaVideo = semana.classes.find(el => {
        return parseInt(el.date) === videoDate
      });
    }else{
      diaVideo = semana.classes[0];
    }
    
    return `${semana.name}_${diaVideo.day}_${day+month+year}_${time}`
  }