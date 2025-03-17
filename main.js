// ========== МОЖНО МЕНЯТЬ ===========
// Время в миллисекундах необходимое сайту, чтобы подгрузить песни в плейлисте.
// Повысь до 200-300 (или выше, если медленный интернет), если скрипт
// не долистывает до самого низа плейлиста.
const SLEEP_BEFORE_NEXT_PAGE_SCROLL = 150
const SLEEP_BEFORE_NEXT_POST_REQUEST = 1500


// ============ НЕ МЕНЯТЬ ============
// Если заглянуть в код страницы, то можно найти div с каждой песней в плейлисте.
// У этого div'a есть атрибут "data-audio", который представляет собой массив с
// кучей элементов. Данные, необходимые для отправки запроса о добавлении песни
// в избранное, находятся под данными индексами.
const INDEX_OF_AUDIO_ID = 0
const INDEX_OF_AUDIO_OWNER_ID = 1
const INDEX_OF_HASH = 13


/**
 * В строке с необходимым нам hash'ем находятся несколько других значений.
 * Возможно, они нужны для других операций с пенями (удаление/восстановление песни),
 * но нам нужно только самое первое значение.
 */
function getHash(str) {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "/") {
      //
    } else {
      str = str.slice(i)
      break
    }
  }

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "/") {
      str = str.slice(0, i)
    } else {
      //
    }
  }

  return str
}

/**
 * Самая обычная sleep функция
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min
}

/**
 * Возвращаем разный список элементов с песнями в зависимости от того, надо ли начать 
 * с какой-то определенной песни.
 */
function getAudioRows() {
  console.log("Нужно продолжить с конкретной песни? (1 - если нужно, 0 - если нет)");
  console.log("(все песни при работе скрипта добавляются начиная от низа плейлиста и к верху)");
  const needToContinue = parseInt(prompt("Нужно продолжить с конкретной песни? (1 - если нужно, 0 - если нет) "))

  let songToStartFrom

  if (needToContinue) {
    let inputSongName = prompt("Введите название песни, с которой нужно продолжить (она не добавится): ")

    if (inputSongName === undefined || inputSongName === null) {
      console.log("Перезагрузите страницу и попробуйте снова");
      throw new Error();
    }

    inputSongName = inputSongName.trim().toLowerCase()

    const tmpApLayer = document.querySelector("div.ap_layer")
    const songNamesInElements = tmpApLayer.querySelectorAll("a.audio_row__title_inner")

    let foundSong

    for (let songName of songNamesInElements) {
      const songNameText = songName.textContent.trim().toLowerCase()
      if (songNameText.includes(inputSongName)) {
        foundSong = songName
        break
      }
    }

    if (foundSong === undefined || foundSong === null) {
      console.log("Песня не найдена :(");
      console.log("Перезагрузите страницу и попробуйте снова");
      throw new Error();
    }

    songToStartFrom = foundSong.closest("div.audio_row")
    const apLayer = document.querySelector("div.ap_layer")
    let audioRows = [...apLayer.querySelectorAll("div.audio_row")]
    return audioRows.slice(0, audioRows.indexOf(songToStartFrom))
  } else {
    // Находим нужные нам div'ы.
    const apLayer = document.querySelector("div.ap_layer")
    return apLayer.querySelectorAll("div.audio_row")
  }
}

/**
 * Функция для проверки и обработки капчи
 */
async function handleCaptcha() {
  // Проверяем, есть ли капча на странице
  const captchaBox = document.querySelector('.captcha');
  if (captchaBox) {
    console.log("%c⚠️ ОБНАРУЖЕНА КАПЧА! Пожалуйста, введите капчу и нажмите кнопку подтверждения", "color: red; font-size: 16px; font-weight: bold;");
    
    // Создаем промис, который будет разрешен, когда капча будет введена
    return new Promise(resolve => {
      // Проверяем состояние капчи каждые 500 мс
      const checkInterval = setInterval(() => {
        // Если капча больше не отображается, считаем, что она введена
        if (!document.querySelector('.captcha')) {
          clearInterval(checkInterval);
          console.log("%c✅ Капча введена! Продолжаем работу...", "color: green; font-size: 14px;");
          resolve();
        }
      }, 500);
    });
  }
  return Promise.resolve(); // Если капчи нет, сразу разрешаем промис
}

/**
 * Отправка запроса с обработкой капчи
 */
async function sendRequestWithCaptchaHandling(song) {
  let success = false;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (!success && attempts < maxAttempts) {
    attempts++;
    try {
      // Отправляем POST запрос на сервера VK
      const response = await new Promise((resolve, reject) => {
        window.ajax.post(
          "/al_audio.php?act=add",
          song,
          {
            onDone: (response) => resolve(response),
            onFail: (error) => reject(error)
          }
        );
      });
      
      success = true;
    } catch (error) {
      console.log(`Ошибка при добавлении песни: ${error}`);
    }
    
    // Проверяем наличие капчи и обрабатываем её
    await handleCaptcha();
    
    if (!success && attempts < maxAttempts) {
      console.log(`Повторная попытка добавления песни (${attempts}/${maxAttempts})...`);
      await sleep(2000); // Небольшая пауза перед повторной попыткой
    }
  }
  
  return success;
}

/**
 * Наблюдатель за изменениями в DOM для обнаружения капчи
 */
function setupCaptchaObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Проверяем, является ли добавленный элемент капчей или содержит её
            if (node.classList?.contains('captcha') || node.querySelector('.captcha')) {
              console.log("%c⚠️ ОБНАРУЖЕНА КАПЧА! Пожалуйста, введите капчу и нажмите кнопку подтверждения", "color: red; font-size: 16px; font-weight: bold;");
            }
          }
        }
      }
    }
  });

  // Начинаем наблюдение за всем документом
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

async function main() {
  // Устанавливаем наблюдатель за капчей
  const captchaObserver = setupCaptchaObserver();
  
  // Пролистываем страницу до самого низа, чтобы подгрузить названия всех песен.
  let prevAudioRow = undefined;

  while (true) {
    const apLayer = document.querySelector("div.ap_layer");
    const audioRows = apLayer.querySelectorAll("div.audio_row");
    const currAudioRow = audioRows[audioRows.length - 1];

    if (currAudioRow === prevAudioRow) {
      console.log("ДОШЕЛ ДО КОНЦА ПЛЕЙЛИСТА");
      break;
    } else {
      currAudioRow.scrollIntoView();
      prevAudioRow = currAudioRow;
      await sleep(SLEEP_BEFORE_NEXT_PAGE_SCROLL);
    }
  }

  const audioRows = getAudioRows();

  /**
   * Создаём массив, в котором будут хранится объекты с данными, необходимыми
   * для отправки запроса о добавлении песни в избранное.
   */
  const songs = [];

  /**
   * Распиливаем атрибут "data-audio" на нужные нам данные и молимся,
   * чтобы VK однажды не поменял индексы элементов.
   */
  audioRows.forEach((audio) => {
    const dataAudioRaw = audio.getAttribute("data-audio");
    const dataAudioJSON = JSON.parse(dataAudioRaw);
    songs.push({
      "audio_id": Number(dataAudioJSON[INDEX_OF_AUDIO_ID]),
      "audio_owner_id": Number(dataAudioJSON[INDEX_OF_AUDIO_OWNER_ID]),
      "hash": getHash(dataAudioJSON[INDEX_OF_HASH])
    });
  });

  // Проходимся по массиву в обратном порядке, чтобы музыка осталась в той же последовательности
  songs.reverse();

  console.log("%c ДОБАВЛЕНИЕ ПЕСЕН НАЧАТО, не закрывайте браузер", "color: blue; font-size: 14px; font-weight: bold;");
  console.log(`Всего песен для добавления: ${songs.length}`);

  let successCount = 0;
  for (let i = 0; i < songs.length; i++) {
    console.log(`Добавление песни ${i+1}/${songs.length}...`);
    
    // Отправляем запрос с обработкой капчи
    const success = await sendRequestWithCaptchaHandling(songs[i]);
    
    if (success) {
      successCount++;
    }
    
    // Добавляем случайную задержку между запросами
    await sleep(SLEEP_BEFORE_NEXT_POST_REQUEST + getRandomNumber(2050, 3498));
  }
  
  console.log(`%c ДОБАВЛЕНИЕ ПЕСЕН ЗАВЕРШЕНО. Успешно добавлено: ${successCount}/${songs.length}`, "color: green; font-size: 14px; font-weight: bold;");
  
  // Отключаем наблюдатель за капчей
  captchaObserver.disconnect();
}

await main();