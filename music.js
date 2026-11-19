(() => {
  const toggle = document.querySelector('#music-toggle');
  const volume = document.querySelector('#music-volume');
  const status = document.querySelector('#music-status');
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  const interval = 60 / 136 / 4;
  const bassNotes = [40, 40, 43, 47, 38, 38, 42, 45, 36, 36, 40, 43, 38, 38, 45, 47];
  const leadNotes = [64, 67, 71, 76, 62, 66, 69, 74, 60, 64, 67, 72, 62, 66, 69, 74];
  let context, output, noise, timer, nextTime;
  let step = 0;

  function initialize() {
    context = new AudioContext();
    output = context.createGain();
    output.gain.value = Number(volume.value) / 100 * .49;
    const limiter = context.createDynamicsCompressor();
    output.connect(limiter);
    limiter.connect(context.destination);
    noise = context.createBuffer(1, Math.floor(context.sampleRate * .22), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    nextTime = context.currentTime + .04;
  }

  function envelope(time, duration, level) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + .005);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    gain.connect(output);
    return gain;
  }

  function tone(time, duration, level, frequency, type, endFrequency = frequency) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration * .65);
    oscillator.connect(envelope(time, duration, level));
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  function percussion(time, duration, level, cutoff, type) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    source.buffer = noise;
    source.connect(filter);
    filter.connect(envelope(time, duration, level));
    source.start(time);
    source.stop(time + duration);
  }

  function schedule() {
    // Skip elapsed beats when the browser throttles a background tab.
    if (nextTime < context.currentTime - interval) nextTime = context.currentTime + .02;
    while (nextTime < context.currentTime + .18) {
      const beat = step % 16;
      const phrase = Math.floor(step / 4);
      const frequency = note => 440 * 2 ** ((note - 69) / 12);
      if (beat % 4 === 0) tone(nextTime, .19, .67, 150, 'sine', 42);
      if (beat === 4 || beat === 12) percussion(nextTime, .14, .27, 1600, 'bandpass');
      if (beat % 2 === 0) percussion(nextTime, beat % 4 === 2 ? .065 : .032, .13, 6600, 'highpass');
      if ([0, 2, 3].includes(step % 4)) {
        const note = frequency(bassNotes[phrase]);
        tone(nextTime, .096, .23, note, 'triangle');
        tone(nextTime, .08, .035, note * 2, 'sawtooth');
      }
      if ([1, 6, 9, 11, 14].includes(beat)) {
        tone(nextTime, .125, .07, frequency(leadNotes[phrase]), 'triangle');
      }
      step = (step + 1) % 64;
      nextTime += interval;
    }
  }

  toggle.addEventListener('click', async () => {
    if (!AudioContext) {
      status.textContent = '此瀏覽器未能播放背景音樂。';
      return;
    }
    toggle.disabled = true;
    try {
      if (timer !== undefined) {
        await context.suspend();
        clearInterval(timer);
        timer = undefined;
      } else {
        if (!context) initialize();
        await context.resume();
        schedule();
        timer = setInterval(schedule, 45);
      }
      const playing = timer !== undefined;
      toggle.textContent = playing ? '暫停音樂' : '播放音樂';
      toggle.setAttribute('aria-pressed', String(playing));
      status.textContent = '';
    } catch {
      status.textContent = '未能切換音樂，請再試一次。';
    } finally {
      toggle.disabled = false;
    }
  });

  volume.addEventListener('input', () => {
    if (context) output.gain.setTargetAtTime(Number(volume.value) / 100 * .49, context.currentTime, .025);
  });
})();
