package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// ── DB ───────────────────────────────────────────────────────────────────────

var db *pgxpool.Pool

func initDB() {
	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "host=localhost port=5432 dbname=harmony_web user=postgres password=tu_password sslmode=disable"
	}

	var err error
	db, err = pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatalf("could not connect to database: %v", err)
	}

	if err := db.Ping(context.Background()); err != nil {
		log.Fatalf("could not ping database: %v", err)
	}

	log.Println("Connected to PostgreSQL")
}

// ── SESSION ──────────────────────────────────────────────────────────────────

var (
	sessions   = map[string]int{}  // token → user ID
	sessionsMu sync.Mutex
)

func newSession(userID int) string {
	token := fmt.Sprintf("%d-%d", userID, time.Now().UnixNano())
	sessionsMu.Lock()
	sessions[token] = userID
	sessionsMu.Unlock()
	return token
}

func getSession(r *http.Request) (int, bool) {
	c, err := r.Cookie("session")
	if err != nil {
		return 0, false
	}
	sessionsMu.Lock()
	id, ok := sessions[c.Value]
	sessionsMu.Unlock()
	return id, ok
}

func deleteSession(token string) {
	sessionsMu.Lock()
	delete(sessions, token)
	sessionsMu.Unlock()
}

// ── MODELS ───────────────────────────────────────────────────────────────────

type ContactForm struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Business string `json:"business"`
	Message  string `json:"message"`
}

type Contact struct {
	ID        int
	Name      string
	Email     string
	Phone     string
	Business  string
	Message   string
	CreatedAt time.Time
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────

func handleContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var form ContactForm
	if err := json.NewDecoder(r.Body).Decode(&form); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(form.Name) == "" ||
		strings.TrimSpace(form.Email) == "" ||
		strings.TrimSpace(form.Message) == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	_, err := db.Exec(context.Background(),
		`INSERT INTO contacts (name, email, phone, business, message)
		 VALUES ($1, $2, $3, $4, $5)`,
		form.Name, form.Email, form.Phone, form.Business, form.Message,
	)
	if err != nil {
		log.Printf("error inserting contact: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("New contact from %s <%s>", form.Name, form.Email)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		log.Printf("error writing response: %v", err)
	}
}

// ── PANEL ────────────────────────────────────────────────────────────────────

var panelLoginTmpl = template.Must(template.New("login").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Panel — Login</title>
  <style>
    body { font-family: monospace; max-width: 360px; margin: 80px auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; }
    input { width: 100%; padding: 0.5rem; margin-bottom: 1rem; box-sizing: border-box; font-family: monospace; }
    button { padding: 0.5rem 1.5rem; font-family: monospace; cursor: pointer; }
    .error { color: red; margin-bottom: 1rem; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>Harmony Panel</h1>
  {{if .Error}}<p class="error">{{.Error}}</p>{{end}}
  <form method="POST" action="/panel/login">
    <label>Username</label>
    <input type="text" name="username" required autofocus />
    <label>Password</label>
    <input type="password" name="password" required />
    <button type="submit">Login</button>
  </form>
</body>
</html>`))

var panelTmpl = template.Must(template.New("panel").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Panel — Contacts</title>
  <style>
    body { font-family: monospace; max-width: 960px; margin: 40px auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { text-align: left; border-bottom: 2px solid #000; padding: 0.5rem; }
    td { border-bottom: 1px solid #ccc; padding: 0.5rem; vertical-align: top; }
    td.message { white-space: pre-wrap; max-width: 300px; }
    a { color: inherit; }
    .empty { color: #999; margin-top: 2rem; }
  </style>
</head>
<body>
  <nav>
    <h1>Harmony Panel — Contacts ({{.Count}})</h1>
    <form method="POST" action="/panel/logout">
      <button type="submit">Logout</button>
    </form>
  </nav>
  {{if .Contacts}}
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Date</th>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Business</th>
        <th>Message</th>
      </tr>
    </thead>
    <tbody>
      {{range .Contacts}}
      <tr>
        <td>{{.ID}}</td>
        <td>{{.CreatedAt.Format "02/01 15:04"}}</td>
        <td>{{.Name}}</td>
        <td><a href="mailto:{{.Email}}">{{.Email}}</a></td>
        <td>{{.Phone}}</td>
        <td>{{.Business}}</td>
        <td class="message">{{.Message}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
  {{else}}
  <p class="empty">No contacts yet.</p>
  {{end}}
</body>
</html>`))

func handlePanel(w http.ResponseWriter, r *http.Request) {
	if _, ok := getSession(r); !ok {
		panelLoginTmpl.Execute(w, nil)
		return
	}

	rows, err := db.Query(context.Background(),
		`SELECT id, name, email, phone, business, message, created_at
		 FROM contacts ORDER BY created_at DESC`)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var contacts []Contact
	for rows.Next() {
		var c Contact
		if err := rows.Scan(&c.ID, &c.Name, &c.Email, &c.Phone, &c.Business, &c.Message, &c.CreatedAt); err != nil {
			continue
		}
		contacts = append(contacts, c)
	}

	panelTmpl.Execute(w, map[string]any{
		"Contacts": contacts,
		"Count":    len(contacts),
	})
}

func handlePanelLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Redirect(w, r, "/panel", http.StatusSeeOther)
		return
	}

	username := r.FormValue("username")
	password := r.FormValue("password")

	var id int
	var hash string
	err := db.QueryRow(context.Background(),
		`SELECT id, password FROM users WHERE username = $1`, username,
	).Scan(&id, &hash)

	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		panelLoginTmpl.Execute(w, map[string]string{"Error": "Invalid credentials"})
		return
	}

	token := newSession(id)
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    token,
		Path:     "/panel",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/panel", http.StatusSeeOther)
}

func handlePanelLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("session"); err == nil {
		deleteSession(c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:   "session",
		Value:  "",
		Path:   "/panel",
		MaxAge: -1,
	})
	http.Redirect(w, r, "/panel", http.StatusSeeOther)
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

func main() {
	initDB()
	defer db.Close()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	mux.HandleFunc("/api/contact", handleContact)
	mux.HandleFunc("/panel/login", handlePanelLogin)
	mux.HandleFunc("/panel/logout", handlePanelLogout)
	mux.HandleFunc("/panel", handlePanel)
	mux.Handle("/", http.FileServer(http.Dir("public")))

	addr := ":" + port
	log.Printf("Server running at http://localhost%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}
