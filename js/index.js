const indexBackgrounds = [
  'img/imagen_1.jpg',
  'img/imagen_2.jpg',
  'img/imagen_3.jpg',
  'img/imagen_4.jpg',
  'img/imagen_5.jpg'
];

indexBackgrounds.forEach((source) => {
  const image = new Image();
  image.src = source;
});

let currentBackground = 0;
setInterval(() => {
  currentBackground = (currentBackground + 1) % indexBackgrounds.length;
  document.body.style.backgroundImage = `linear-gradient(rgba(4,8,18,.38), rgba(4,8,18,.38)), url('${indexBackgrounds[currentBackground]}')`;
}, 4000);

