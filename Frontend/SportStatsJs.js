document.addEventListener("mousemove", (event) => {
    const hero = document.querySelector(".hero");
    const { clientX: x, clientY: y } = event;
    
    // Получаваме размерите на елемента
    const { width, height, left, top } = hero.getBoundingClientRect();
    
    // Нормализираме координатите (стойности от 0 до 1)
    const xPercent = (x - left) / width;
    const yPercent = (y - top) / height;

    // Генерираме нов градиент спрямо позицията на мишката
    hero.style.background = `linear-gradient(${xPercent * 360}deg, var(--secondary-color) 40%, var(--highlight-color) 100%)`;
});
