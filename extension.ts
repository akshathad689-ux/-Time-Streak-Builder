import * as vscode from 'vscode';

let timer: NodeJS.Timeout | undefined;
let seconds = 0;
let running = false;

let dailyHistory: { [date: string]: number } = {};

let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {

    extensionContext = context;

    // Load saved daily history
    dailyHistory = context.globalState.get<{ [date: string]: number }>(
        'dailyHistory',
        {}
    );

    const provider = new TimeStreakProvider();

    vscode.window.registerTreeDataProvider(
        'timeStreak',
        provider
    );

    // START
    context.subscriptions.push(
        vscode.commands.registerCommand('timeStreak.start', () => {

            if (!running) {
                running = true;

                timer = setInterval(async () => {

                    seconds++;

                    const today = getToday();

                    if (!dailyHistory[today]) {
                        dailyHistory[today] = 0;
                    }

                    dailyHistory[today]++;

                    await context.globalState.update(
                        'dailyHistory',
                        dailyHistory
                    );

                    provider.refresh();

                }, 1000);

                provider.refresh();
            }
        })
    );

    // PAUSE
    context.subscriptions.push(
        vscode.commands.registerCommand('timeStreak.pause', async () => {

            running = false;

            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }

            await saveHistory();

            provider.refresh();
        })
    );

    // RESET CURRENT TIMER
    context.subscriptions.push(
        vscode.commands.registerCommand('timeStreak.reset', () => {

            running = false;

            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }

            seconds = 0;

            provider.refresh();
        })
    );

    // OPEN DASHBOARD
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'timeStreak.dashboard',
            () => {
                openDashboard(context);
            }
        )
    );
}

function getToday(): string {

    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

async function saveHistory() {

    await extensionContext.globalState.update(
        'dailyHistory',
        dailyHistory
    );
}

function formatTime(totalSeconds: number): string {

    const hours = Math.floor(totalSeconds / 3600);

    const minutes =
        Math.floor((totalSeconds % 3600) / 60);

    const seconds =
        totalSeconds % 60;

    return (
        `${hours.toString().padStart(2, '0')}:` +
        `${minutes.toString().padStart(2, '0')}:` +
        `${seconds.toString().padStart(2, '0')}`
    );
}

class TimeStreakProvider
    implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData =
        new vscode.EventEmitter<void>();

    readonly onDidChangeTreeData =
        this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(
        element: vscode.TreeItem
    ): vscode.TreeItem {

        return element;
    }

    getChildren(): vscode.TreeItem[] {

        const timerItem = new vscode.TreeItem(
            `⏱️ ${formatTime(seconds)}`
        );

        const statusItem = new vscode.TreeItem(
            running
                ? '🟢 Working'
                : '⏸️ Paused'
        );

        const dashboardItem = new vscode.TreeItem(
            '📊 Open Dashboard'
        );

        dashboardItem.command = {
            command: 'timeStreak.dashboard',
            title: 'Open Dashboard'
        };

        return [
            timerItem,
            statusItem,
            dashboardItem
        ];
    }
}

function openDashboard(
    context: vscode.ExtensionContext
) {

    const panel = vscode.window.createWebviewPanel(
        'timeStreakDashboard',
        'Time Streak Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: false
        }
    );

    const entries =
        Object.entries(dailyHistory)
            .sort((a, b) =>
                b[0].localeCompare(a[0])
            );

    let rows = '';

    for (const [date, totalSeconds] of entries) {

        rows += `
            <tr>
                <td>${date}</td>
                <td>${formatTime(totalSeconds)}</td>
            </tr>
        `;
    }

    if (rows === '') {

        rows = `
            <tr>
                <td colspan="2">
                    No practice history yet.
                </td>
            </tr>
        `;
    }

    const totalSeconds =
        Object.values(dailyHistory)
            .reduce(
                (sum, value) => sum + value,
                0
            );

    const daysPracticed =
        Object.keys(dailyHistory).length;

    panel.webview.html = `

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <style>

                body {
                    font-family: sans-serif;
                    padding: 25px;
                }

                h1 {
                    margin-bottom: 25px;
                }

                .cards {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .card {
                    padding: 20px;
                    border: 1px solid #888;
                    border-radius: 10px;
                    min-width: 160px;
                }

                .number {
                    font-size: 24px;
                    font-weight: bold;
                    margin-top: 8px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th,
                td {
                    padding: 12px;
                    border-bottom: 1px solid #888;
                    text-align: left;
                }

            </style>

        </head>

        <body>

            <h1>📊 Time Streak Dashboard</h1>

            <div class="cards">

                <div class="card">

                    Days Practiced

                    <div class="number">
                        ${daysPracticed}
                    </div>

                </div>

                <div class="card">

                    Total Practice Time

                    <div class="number">
                        ${formatTime(totalSeconds)}
                    </div>

                </div>

            </div>

            <h2>Daily History</h2>

            <table>

                <tr>
                    <th>Date</th>
                    <th>Practice Time</th>
                </tr>

                ${rows}

            </table>

        </body>

        </html>
    `;
}

export function deactivate() {

    if (timer) {
        clearInterval(timer);
    }

    // History is also updated every second,
    // so the saved data remains available.
}
