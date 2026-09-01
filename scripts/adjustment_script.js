let sweepValue = Number(document.getElementById("sweepValue").innerHTML)
const sweepElement = document.getElementById("sweepValue")
const mainStartBtn = document.getElementById("mainStartBtn")
const ascendBox = document.getElementById("ascendBox")
const descendBox = document.getElementById("descendBox")
const newPatientBtn = document.getElementById("newPatientBtn")
let handImage = document.getElementById("handImage")
let threshold = Math.floor(Math.random() * 70)

let audioContext = null
let oscillator = null
let gainNode = null

const frequency = 500
function startSound() {

    if (audioContext === null) {

        audioContext = new AudioContext()

        oscillator = audioContext.createOscillator()
        gainNode = audioContext.createGain()

        oscillator.type = "sine"
        oscillator.frequency.value = frequency

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        gainNode.gain.value = 0

        oscillator.start()
    }

    if (audioContext.state === "suspended") {
        audioContext.resume()
    }

    setSoundLevel(sweepValue)
}

function setSoundLevel(db) {

    if (gainNode === null) {
        return
    }

    const gain = 0.2 * Math.pow(10, (db - 70)*0.25 / 20)

    gainNode.gain.setTargetAtTime(
        gain,
        audioContext.currentTime,
        0.01
    )
}


function resetPlot() {
    Plotly.react("plot", [
        {
            x: [],
            y: [],
            mode: "lines+markers"
        }
    ], {
        yaxis: {
            range: [0, 70],
            dtick: 5
        },

        xaxis: {
            range: [0, 10],
            dtick: 1
        }
    });
}

function stopSound() {

    if (audioContext === null || oscillator === null) {
        return
    }

    gainNode.gain.setTargetAtTime(
        0,
        audioContext.currentTime,
        0.01
    )

    setTimeout(() => {
        oscillator.stop()

        audioContext.close()

        audioContext = null
        oscillator = null
        gainNode = null
    }, 100)
}

function newPatient () {
    threshold = Math.floor(Math.random() * 70)
    resetPlot()
}

function descendSweep() {
    handImage.src = "../images/holding.png"
    descendBox.classList.add("on")
    ascendBox.classList.remove("on")
    sweepValue = sweepValue - 5
    sweepElement.innerHTML = sweepValue
    let record = sweepValue
    setSoundLevel(sweepValue)
    return record
}

function ascendSweep() {
    handImage.src = "../images/releasing.png"
    descendBox.classList.remove("on")
    ascendBox.classList.add("on")
    sweepValue = sweepValue + 5
    sweepElement.innerHTML = sweepValue
    let record = sweepValue
    setSoundLevel(sweepValue)
    return record
}

function checkThreshold() {

    let record

    if (sweepValue >= threshold) {
        record = descendSweep()
    } else {
        record = ascendSweep()
    }

    return record
}


const x = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7];
let y = [sweepValue];

Plotly.newPlot("plot", [
    {
        x: [],
        y: [],
        mode: "lines+markers"
    }
], {
    yaxis: {
        range: [0, 70],
        dtick: 5
    },

    xaxis: {
        range: [0, 10],
        dtick: 1
    }
});

let i = 0;
let animation = null;

newPatientBtn.addEventListener("click", () => {
    newPatient()
})

mainStartBtn.addEventListener("click", () => {
    startSound()
    i = 0
    y = []
    resetPlot()
    sweepValue = Number(document.getElementById("sweepValue").innerHTML)

    if (animation !== null) {
        clearInterval(animation)
    }

    animation = setInterval(() => {

        let record = checkThreshold()
        y.push(record)
        Plotly.extendTraces("plot", {
            x: [[x[i]]],
            y: [[y[i]]]
        }, [0])
        i++
        if (i >= x.length) {
            clearInterval(animation)
            stopSound()
            animation = null
        }

    }, 500)
})