let reading = false;
let duration = 1; // Duration in minutes
let remainingTimeInterval = null;
let totalTime
// Function to update the duration value
function updateDuration(value) {
    duration = parseInt(value);
    document.getElementById('durationValue').innerText = `${value} минут${value > 1 ? 'ы' : 'а'}`;
}

// Function to update the remaining time display
function updateRemainingTime(seconds) {
    let minutes = Math.floor(seconds / 60);
    let secs = seconds % 60;
    document.getElementById('remainingTime').innerText = `Оставшееся время: ${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

// Function to toggle reading state
function toggleReading() {
    reading = !reading;
    let button = document.getElementById('startReadingBtn');
    if (reading) {
        button.classList.remove('btn-primary');
        button.classList.add('btn-danger');
        button.innerText = 'Остановить чтение данных';
        let selectedPort = document.getElementById('comPortSelect').value;
        eel.start_reading(selectedPort, duration);
        totalTime = duration * 60;
        remainingTimeInterval = setInterval(() => {
            totalTime--;
            if (totalTime <= 0) {
                clearInterval(remainingTimeInterval);
                resetButtons(); // Call function to reset buttons
            }
            updateRemainingTime(totalTime);
        }, 1000);
    } else {
        button.classList.remove('btn-danger');
        button.classList.add('btn-primary');
        button.innerText = 'Начать чтение данных';
        eel.stop_reading();
        clearInterval(remainingTimeInterval);
    }
}

// Function to reset button states
function resetButtons() {
    // Reset reading button
    let startButton = document.getElementById('startReadingBtn');
    startButton.classList.remove('btn-danger');
    startButton.classList.add('btn-primary');
    startButton.innerText = 'Начать чтение данных';

    // Reset plate button
    let plateButton = document.getElementById('togglePlitaBtn');
    plateButton.classList.remove('btn-success');
    plateButton.classList.add('btn-primary');
    document.getElementById('status6').innerText = 'Pin 6 is LOW';

    // Reset prived button
    let privedButton = document.getElementById('togglePrivedBtn');
    privedButton.classList.remove('btn-success');
    privedButton.classList.add('btn-primary');
    document.getElementById('status7').innerText = 'Pin 7 is LOW';

    // Reset plate status
    let plateStatusDiv = document.getElementById('plateStatus');
    plateStatusDiv.classList.remove('status-up', 'status-down');
    plateStatusDiv.classList.add('status');
}

// Expose function to update plate status from Python
eel.expose(updatePlateStatus);
function updatePlateStatus(status) {
    const plateStatusDiv = document.getElementById('plateStatus');
    plateStatusDiv.innerText = status;
    if (status === "Плита поднята") {
        plateStatusDiv.classList.remove('status-down', 'status');
        plateStatusDiv.classList.add('status-up');
    } else if (status === "Плита опущена") {
        plateStatusDiv.classList.remove('status-up', 'status');
        plateStatusDiv.classList.add('status-down');
    } else if (status === "Состояние плиты: неизвестно") {
        plateStatusDiv.classList.remove('status-up', 'status-down');
        plateStatusDiv.classList.add('status');
    }
}

// Function to toggle pin states
async function togglePin(pin) {
    try {
        console.log("Toggling pin", pin);  // Debugging log
        let response = await eel.toggle_pin(pin)();
        console.log("Response from toggle_pin:", response);  // Debugging log
        if (response && response.pin !== undefined && response.state !== undefined) {
            document.getElementById(`status${pin}`).innerText = `Pin ${pin} is ${response.state}`;
            let button = document.getElementById('toggle' + (pin == 6 ? 'Plita' : 'Prived') + 'Btn');
            let status = document.getElementById('status' + pin);
            if (button.classList.contains('btn-primary')) {
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
                status.innerText = 'Pin ' + pin + ' is HIGH';
                if (pin == 7) {
                    setTimeout(resetChartsAndTables()); // Reset charts and tables when prived is turned on
                }
            } else {
                button.classList.remove('btn-success');
                button.classList.add('btn-primary');
                status.innerText = 'Pin ' + pin + ' is LOW';
            }
        } else {
            throw new Error("Invalid response received");
        }
    } catch (error) {
        console.error("Error toggling pin:", error);
        alert("Failed to toggle pin. Please try again.");
    }
}

// Function to be executed on window load
window.onload = function() {
    eel.get_com_ports()(ports => {
        let comPortSelect = document.getElementById('comPortSelect');
        ports.forEach(port => {
            let option = document.createElement('option');
            option.value = port;
            option.text = port;
            comPortSelect.appendChild(option);
        });
    });
    createCharts();
}

// Function to create charts
function createCharts() {
    let margin = { top: 20, right: 30, bottom: 30, left: 40 };
    let width = 800 - margin.left - margin.right;
    let height = 300 - margin.top - margin.bottom;

    // Create Max/Min chart
    let svgMaxMin = d3.select("#maxMinChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let xMaxMin = d3.scaleLinear().range([0, width]);
    let yMaxMin = d3.scaleLinear().range([height, 0]);

    let lineMaxMin = d3.line()
        .x(d => xMaxMin(d.time))
        .y(d => yMaxMin(d.value));

    svgMaxMin.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xMaxMin));

    svgMaxMin.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(yMaxMin));

    svgMaxMin.append("path")
        .datum([])
        .attr("class", "line")
        .attr("d", lineMaxMin)
        .style("fill", "none")
        .style("stroke", "steelblue")
        .style("stroke-width", "2px");

    // Save charts in global variable
    window.charts = {svgMaxMin, xMaxMin, yMaxMin, lineMaxMin };
}

// Expose function to update Max/Min chart

eel.expose(updateMaxMinChart);
function updateMaxMinChart(time, raznica, min, max) {
    if (typeof time === 'number' && typeof raznica === 'number' && typeof min === 'number' && typeof max === 'number' && time != NaN && raznica != NaN && min != NaN  && max != NaN) {
        let { svgMaxMin, xMaxMin, yMaxMin, lineMaxMin } = window.charts;

        // Get the data from the svg element
        let data = svgMaxMin.select(".line").datum();

        // If data is undefined, initialize it as an empty array
        if (data === undefined) {
            data = [];
        }

        // Add the new data point
        data.push({ time, value: raznica });

        // Update the scales' domains
        xMaxMin.domain(d3.extent(data, d => d.time));
        yMaxMin.domain(d3.extent(data, d => d.value));

        // Update the line and axes
        svgMaxMin.select(".line")
            .datum(data)
            .attr("d", lineMaxMin);

        svgMaxMin.select(".x.axis").call(d3.axisBottom(xMaxMin)); // Update x-axis
        svgMaxMin.select(".y.axis").call(d3.axisLeft(yMaxMin));

        // Remove old points
        svgMaxMin.selectAll(".dot").remove();

        // Add points
        svgMaxMin.selectAll(".dot")
            .data(data)
            .enter().append("circle")
            .attr("class", "dot")
            .attr("cx", d => xMaxMin(d.time))
            .attr("cy", d => yMaxMin(d.value))
            .attr("r", 3)
            .style("fill", "steelblue");

        // Update the table
        let table = document.getElementById('dataTable2').getElementsByTagName('tbody')[0];
        let row = table.insertRow();
        let cell_time = row.insertCell(0);
        let cell_raznica = row.insertCell(1);
        let cell_max = row.insertCell(2);
        let cell_min = row.insertCell(3);
        cell_time.innerHTML = time; // Display time as the X value
        cell_raznica.innerHTML = raznica;
        cell_max.innerHTML = max;
        cell_min.innerHTML = min;
    } else {
        console.error('Invalid data received for updateMaxMinChart:', time, raznica, min, max);
    }
}

// Function to save table data to Excel
function saveToExcel() {
    let table = document.getElementById('dataTable2');
    let rows = table.getElementsByTagName('tr');
    let csvContent = [];

    // Loop through rows and cells to extract data
    for (let i = 0; i < rows.length; i++) {
        let cells = rows[i].getElementsByTagName('td');
        let rowData = [];
        for (let j = 0; j < cells.length; j++) {
            rowData.push(cells[j].innerText);
        }
        csvContent.push(rowData.join(','));
    }

    // Join data into CSV format
    let csvData = csvContent.join('\n');

    // Create a blob with the CSV data
    let blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

    // Create a link element to trigger the download
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'min_max_data.csv');
    link.style.display = 'none';

    // Append the link to the document and click it programmatically
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
}

function saveChartAsPNG() {
    let svg = document.getElementById("maxMinChart");
    let canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth;
    canvas.height = svg.clientHeight;
    let ctx = canvas.getContext("2d");

    let image = new Image();
    image.onload = function() {
        ctx.drawImage(image, 0, 0);

        // Создание ссылки для скачивания изображения
        let link = document.createElement("a");
        link.download = "chart.png";
        link.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        link.click();
    };
    image.src = "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(svg));
}

// Функция для получения строки SVG из контейнера
function getSVGString(svgNode) {
    svgNode.setAttribute("xlink", "http://www.w3.org/1999/xlink");
    let cssStyleText = getCSSStyles(svgNode);
    appendCSS(cssStyleText, svgNode);

    let serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgNode);
    svgString = svgString.replace(/(\w+)?:?xlink=/g, "xmlns:xlink=");
    svgString = svgString.replace(/NS\d+:href/g, "xlink:href");

    return svgString;
}

// Функция для получения стилей CSS элементов SVG
function getCSSStyles(parentElement) {
    let styles = "";

    function traverseStyles(node) {
        if (node.nodeType === 1) {
            let computedStyle = getComputedStyle(node);
            styles += node.tagName + " {";
            for (let i = 0; i < computedStyle.length; i++) {
                styles += `${computedStyle[i]}: ${computedStyle.getPropertyValue(computedStyle[i])};`;
            }
            styles += "}";
            for (let i = 0; i < node.childNodes.length; i++) {
                traverseStyles(node.childNodes[i]);
            }
        }
    }

    traverseStyles(parentElement);
    return styles;
}

// Функция для добавления стилей CSS в строку SVG
function appendCSS(cssText, element) {
    let styleElement = document.createElement("style");
    styleElement.setAttribute("type", "text/css");
    styleElement.innerHTML = cssText;
    let refNode = element.hasChildNodes() ? element.children[0] : null;
    element.insertBefore(styleElement, refNode);
}

// Function to reset charts and tables
function resetChartsAndTables() {
    totalTime = duration * 60;
    updateRemainingTime(totalTime);

    // Clear data in table 2
    let table2 = document.getElementById('dataTable2').getElementsByTagName('tbody')[0];
    table2.innerHTML = '';

    // Clear data in Max/Min chart
    let { svgMaxMin, xMaxMin, yMaxMin, lineMaxMin } = window.charts;

    // Reset data
    let dataMaxMin = [];

    // Reset domain for x and y axes
    xMaxMin.domain([0, 1]);
    yMaxMin.domain([0, 1]);

    // Update the line path with empty data
    svgMaxMin.select(".line")
        .datum(dataMaxMin)
        .attr("d", lineMaxMin);

    // Update the axes with the new empty domain
    svgMaxMin.select(".x.axis").call(d3.axisBottom(xMaxMin));
    svgMaxMin.select(".y.axis").call(d3.axisLeft(yMaxMin));

    // Remove all existing dots
    svgMaxMin.selectAll(".dot").remove();
    eel.start_reading1(duration);
}


// Function to be executed on window unload
window.onunload = function() {
    eel.close_application();
};