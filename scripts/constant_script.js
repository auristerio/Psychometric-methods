const presentBtn = document.getElementById("presentBtn")
const slm1 = document.getElementById("slm1")
const slm2 = document.getElementById("slm2")
const slm3 = document.getElementById("slm3")
const slm4 = document.getElementById("slm4")
const slm5 = document.getElementById("slm5")
const slm6 = document.getElementById("slm6")
const slm7 = document.getElementById("slm7")
const slm8 = document.getElementById("slm8")

let slm1Result = document.getElementById("slm1Result")
let slm2Result = document.getElementById("slm2Result")
let slm3Result = document.getElementById("slm3Result")
let slm4Result = document.getElementById("slm4Result")
let slm5Result = document.getElementById("slm5Result")
let slm6Result = document.getElementById("slm6Result")
let slm7Result = document.getElementById("slm7Result")
let slm8Result = document.getElementById("slm8Result")
let slmResults = [slm1Result, slm2Result, slm3Result, slm4Result,
    slm5Result, slm6Result, slm7Result, slm8Result]

let slm1Grid = document.getElementById("slm1Grid")
let slm2Grid = document.getElementById("slm2Grid")
let slm3Grid = document.getElementById("slm3Grid")
let slm4Grid = document.getElementById("slm4Grid")
let slm5Grid = document.getElementById("slm5Grid")
let slm6Grid = document.getElementById("slm6Grid")
let slm7Grid = document.getElementById("slm7Grid")
let slm8Grid = document.getElementById("slm8Grid")
let slmGrids = [slm1Grid, slm2Grid, slm3Grid, slm4Grid,
    slm5Grid, slm6Grid, slm7Grid, slm8Grid]


const samples = [slm1, slm2, slm3, slm4, slm5
    , slm6, slm7, slm8]
const presentTimesField = document.getElementById("presentTimes")
const resultPresentTimes = document.querySelectorAll(".resultPresentTimes")
const resetBtn = document.getElementById("resetBtn")
let x = samples.map(sample => Number(sample.value))
let y = [0, 0, 0, 0, 0, 0, 0, 0]
let probality;
let count;
let percentage;
let response;

function responseProbability(input, threshold, distance, k) {

    if (input <= threshold - distance) {
        return 0;
    }
    else if (input >= threshold + distance) {
        return 1;
    }
    else {
        return 1 / (1 + Math.exp(-k * (input - threshold)));
    }
}

function checkResponse(stimulus,patientThreshold) {
    probality = responseProbability(stimulus, patientThreshold, 5, 0.7)
    let randomNumber = Math.random()
    if (randomNumber <= probality) {
        response = 1
        return response
    } else {
        response = 0
        return response
    }
}

function findThreshold() {

    const presentTimes = Number(presentTimesField.value)
    const patientThreshold = Number(document.getElementById("currentInt").value)
    const collection = new Array(presentTimes).fill(0)

    for (let i = 0; i < samples.length; i++) {

        for (let j = 0; j < presentTimes; j++) {
            collection[j] = checkResponse(Number(samples[i].value),patientThreshold)
        }

        count = collection.filter(x => x === 1).length

        slmResults[i].innerHTML = count

        percentage = (count / presentTimes) * 100
        y[i] = percentage
    }

    return y
}

const layout = {
    yaxis: {
        range: [0, 110],
        dtick: 25,
        title: "Correct (%)",
        fixedrange: true
    },

    xaxis: {
        dtick: 2,
        title: "Level (dB HL)",
        fixedrange: true
    },

    dragmode: false
};

const config = {
    displayModeBar: false
};

function resetPlot() {
    x = samples.map(sample => Number(sample.value))
    y = new Array(samples.length).fill(0)

    slmResults.forEach(result => {
        result.innerHTML = "0"
    })

    Plotly.react("plot", [{
        x,
        y,
        mode: "lines+markers"
    }], layout, config)
}

Plotly.newPlot("plot", [
    {
        x,
        y,
        mode: "lines+markers"
    }
], layout, config);

slm1.addEventListener("input", () => {
    slm1Grid.innerHTML =  slm1.value
})

slm2.addEventListener("input", () => {
    slm2Grid.innerHTML =  slm2.value
})

slm3.addEventListener("input", () => {
    slm3Grid.innerHTML =  slm3.value
})

slm4.addEventListener("input", () => {
    slm4Grid.innerHTML =  slm4.value
})

slm5.addEventListener("input", () => {
    slm5Grid.innerHTML =  slm5.value
})

slm6.addEventListener("input", () => {
    slm6Grid.innerHTML =  slm6.value
})

slm7.addEventListener("input", () => {
    slm7Grid.innerHTML =  slm7.value
})

slm8.addEventListener("input", () => {
    slm8Grid.innerHTML =  slm8.value
})

presentTimesField.addEventListener("input", () => {
    resultPresentTimes.forEach(result => {
        result.innerHTML = presentTimesField.value
    })
})

presentBtn.addEventListener("click", () => {
    console.log("BUTTON PRESSED")
    x = samples.map(sample => Number(sample.value))
    y = findThreshold()
    console.log("NEW Y:", y)

    Plotly.react("plot", [{
        x,
        y,
        mode: "lines+markers"
    }],

        {
            yaxis: {
                range: [0, 110],
                dtick: 25,
                title: "Correct (%)",
            },

            xaxis: {
                dtick: 2,
                title: "Level (dB HL)",
            },
        });
})

resetBtn.addEventListener("click", () => {
    resetPlot()
})