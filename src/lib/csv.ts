export function downloadCSV(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function generateTripCSV(activities: any[]): string {
    const csvRows = [];
    const headers = ['Date', 'Time', 'Title', 'Category', 'Location', 'Cost', 'Notes'];
    csvRows.push(headers.join(','));

    for (const act of activities) {
        const row = [
            `"${act.date || ''}"`,
            `"${act.time || ''}"`,
            `"${(act.title || '').replace(/"/g, '""')}"`,
            `"${act.category || ''}"`,
            `"${(act.location || '').replace(/"/g, '""')}"`,
            `"${(act.cost || '').replace(/"/g, '""')}"`,
            `"${(act.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
        ];
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}
