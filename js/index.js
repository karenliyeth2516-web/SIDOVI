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

const backgroundFadeDuration = 2000;
const backgroundChangeInterval = 9000;
let currentBackground = 0;
let visibleLayer = document.createElement('div');
visibleLayer.className = 'index-background-layer is-visible';
visibleLayer.setAttribute('aria-hidden', 'true');
visibleLayer.style.backgroundImage = `linear-gradient(rgba(4,8,18,.38), rgba(4,8,18,.38)), url('${indexBackgrounds[currentBackground]}')`;
document.body.prepend(visibleLayer);

setInterval(() => {
  currentBackground = (currentBackground + 1) % indexBackgrounds.length;

  const nextLayer = document.createElement('div');
  nextLayer.className = 'index-background-layer';
  nextLayer.setAttribute('aria-hidden', 'true');
  nextLayer.style.backgroundImage = `linear-gradient(rgba(4,8,18,.38), rgba(4,8,18,.38)), url('${indexBackgrounds[currentBackground]}')`;
  document.body.prepend(nextLayer);

  visibleLayer.classList.remove('is-visible');
  visibleLayer.classList.add('is-exiting');

  window.setTimeout(() => {
    nextLayer.classList.add('is-visible');
  }, 50);

  window.setTimeout(() => {
    visibleLayer.remove();
    visibleLayer = nextLayer;
  }, backgroundFadeDuration);
}, backgroundChangeInterval);
