import Site from './site.html';

const init = () => {
  if (document.body) {
    new Site({ target: document.body });
  } else {
    setTimeout(init, 10);
  }
};

init();
