# Wettkampf-Ergebnisse (4.6.1)

Privater Bucket match-results im Schussbuch-Projekt eingerichtet am 31.10.2026, maximal 10 MB je PDF. Bestehende Daten unverändert. SQL-Migration private_competition_result_pdfs angewendet.

Eintrag > Wettkampf > Ergebnis-PDFs auswählen > Speichern. Bestehende Einträge: Buch > Bearbeiten > Ergebnis-PDFs > Hochladen. Mehrere PDFs möglich. Beim Behördendokument Checkbox setzen, um Ergebnis-PDFs der Wettkämpfe im ausgewählten Kalenderjahr nach dem Schussbuch anzuhängen. Maßgeblich ist das Wettkampfdatum. Ohne Haken bleibt die bisherige Ausgabe unverändert. Anhänge einzeln herunterladen; sie sind nicht im JSON-Backup enthalten.

Verifiziert: private Bucket-Konfiguration, PDF-Typ und Größenlimit; vorhandene Storage-Policies beschränken sich auf ihre jeweiligen Buckets; fünf Policy-Auswertungen unter authenticated mit tatsächlichen Sessions: eigener Wettkampf erlaubt, fremder Pfad/nicht existierende Session/Training/Nicht-PDF beim Anlegen abgewiesen. Keine Testdaten dauerhaft angelegt. Sicherheitsadvisor meldet keine neue Storage-Warnung (bestehende Warnung zum Passwortschutz unverändert).

Lokale Tests: Jahres- und Typfilter, Reihenfolge, vollständige Originalseiten mit Seitengrößen, Ausgabe ohne Anhänge, ungültige/zu große PDFs und Ladefehler. Upload mit simuliertem Storage: Teilfehler wiederholt nur ausstehende Dateien, Nutzerwechsel verwirft Upload, Zurücksetzen leert die Auswahl. JavaScript-Syntax geprüft. Kein vollständiger angemeldeter Browser-/iPhone-Test oder Upload über die echte Storage-API.
