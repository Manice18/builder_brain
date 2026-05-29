# BuilderBrain — run frontend + backend together
#
#   make install     npm install in builder_brain_be + builder_brain_fe
#   make start-dev   Start BE (tsx watch :8080) + FE (next dev :3000)
#   make stop-dev    Stop dev processes
#   make start-prod  Build + start BE (node) + FE (next start)
#   make stop-prod   Stop prod processes
#   make status      Show running processes

ROOT_DIR     := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
BE_DIR       := $(ROOT_DIR)builder_brain_be
FE_DIR       := $(ROOT_DIR)builder_brain_fe
PID_DIR      := $(ROOT_DIR).pids
LOG_DIR      := $(ROOT_DIR).logs
BE_PORT      := 8080
FE_PORT      := 3000

BE_DEV_PID   := $(PID_DIR)/be-dev.pid
FE_DEV_PID   := $(PID_DIR)/fe-dev.pid
BE_PROD_PID  := $(PID_DIR)/be-prod.pid
FE_PROD_PID  := $(PID_DIR)/fe-prod.pid

.PHONY: install help start-dev stop-dev start-prod stop-prod build-prod status

help:
	@echo "BuilderBrain Makefile targets:"
	@echo "  make install      Install npm dependencies (backend + frontend)"
	@echo "  make start-dev    Start dev servers (:8080 API, :3000 app)"
	@echo "  make stop-dev     Stop dev servers"
	@echo "  make build-prod   Build backend + frontend"
	@echo "  make start-prod   Build and start production servers"
	@echo "  make stop-prod    Stop production servers"
	@echo "  make status       Show PID / running state"

install:
	@echo "Installing backend dependencies ($(BE_DIR))..."
	@cd "$(BE_DIR)" && npm install
	@echo "Installing frontend dependencies ($(FE_DIR))..."
	@cd "$(FE_DIR)" && npm install
	@echo ""
	@echo "Done. Next: configure .env files, coral source add, then make start-dev"

start-dev: dirs
	@$(call require_not_running,be-dev,$(BE_DEV_PID))
	@$(call require_not_running,fe-dev,$(FE_DEV_PID))
	@echo "Starting backend (dev) on :$(BE_PORT)..."
	@cd "$(BE_DIR)" && nohup npm run dev >> "$(LOG_DIR)/be-dev.log" 2>&1 & echo $$! > "$(BE_DEV_PID)"
	@echo "Starting frontend (dev) on :$(FE_PORT)..."
	@cd "$(FE_DIR)" && nohup npm run dev >> "$(LOG_DIR)/fe-dev.log" 2>&1 & echo $$! > "$(FE_DEV_PID)"
	@sleep 1
	@echo ""
	@echo "Dev stack running"
	@echo "  API:  http://localhost:$(BE_PORT)"
	@echo "  App:  http://localhost:$(FE_PORT)"
	@echo "  Logs: $(LOG_DIR)/{be-dev,fe-dev}.log"
	@echo "  Stop: make stop-dev"

stop-dev:
	@echo "Stopping dev stack..."
	@$(call stop_pid,backend dev,$(BE_DEV_PID))
	@$(call stop_pid,frontend dev,$(FE_DEV_PID))
	@$(call free_port,$(BE_PORT))
	@$(call free_port,$(FE_PORT))
	@echo "Dev stack stopped."

build-prod:
	@echo "Building backend..."
	@cd "$(BE_DIR)" && npm run build
	@echo "Building frontend..."
	@cd "$(FE_DIR)" && npm run build

start-prod: build-prod dirs
	@$(call require_not_running,be-prod,$(BE_PROD_PID))
	@$(call require_not_running,fe-prod,$(FE_PROD_PID))
	@test -f "$(BE_DIR)/dist/server.js" || (echo "Missing $(BE_DIR)/dist/server.js — build failed?" && exit 1)
	@echo "Starting backend (prod) on :$(BE_PORT)..."
	@cd "$(BE_DIR)" && ENVIRONMENT=production nohup npm start >> "$(LOG_DIR)/be-prod.log" 2>&1 & echo $$! > "$(BE_PROD_PID)"
	@echo "Starting frontend (prod) on :$(FE_PORT)..."
	@cd "$(FE_DIR)" && nohup npm start >> "$(LOG_DIR)/fe-prod.log" 2>&1 & echo $$! > "$(FE_PROD_PID)"
	@sleep 1
	@echo ""
	@echo "Prod stack running"
	@echo "  API:  http://localhost:$(BE_PORT)"
	@echo "  App:  http://localhost:$(FE_PORT)"
	@echo "  Logs: $(LOG_DIR)/{be-prod,fe-prod}.log"
	@echo "  Stop: make stop-prod"

stop-prod:
	@echo "Stopping prod stack..."
	@$(call stop_pid,backend prod,$(BE_PROD_PID))
	@$(call stop_pid,frontend prod,$(FE_PROD_PID))
	@$(call free_port,$(BE_PORT))
	@$(call free_port,$(FE_PORT))
	@echo "Prod stack stopped."

status:
	@$(call print_status,be-dev,$(BE_DEV_PID),backend dev)
	@$(call print_status,fe-dev,$(FE_DEV_PID),frontend dev)
	@$(call print_status,be-prod,$(BE_PROD_PID),backend prod)
	@$(call print_status,fe-prod,$(FE_PROD_PID),frontend prod)

dirs:
	@mkdir -p "$(PID_DIR)" "$(LOG_DIR)"

# --- helpers (do not call directly) ---

define require_not_running
	if [ -f "$(2)" ]; then \
		pid=$$(cat "$(2)"); \
		if kill -0 $$pid 2>/dev/null; then \
			echo "Error: $(1) already running (pid $$pid). Run make stop-dev or make stop-prod."; \
			exit 1; \
		fi; \
		rm -f "$(2)"; \
	fi
endef

define stop_pid
	if [ -f "$(2)" ]; then \
		pid=$$(cat "$(2)"); \
		if kill -0 $$pid 2>/dev/null; then \
			echo "  Stopping $(1) (pid $$pid)..."; \
			kill $$pid 2>/dev/null || true; \
			sleep 0.5; \
			kill -9 $$pid 2>/dev/null || true; \
		else \
			echo "  $(1): stale pid file removed"; \
		fi; \
		rm -f "$(2)"; \
	else \
		echo "  $(1): not running (no pid file)"; \
	fi
endef

define free_port
	pids=$$(lsof -ti:$(1) 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		echo "  Freeing port $(1) ($$pids)..."; \
		kill $$pids 2>/dev/null || true; \
		sleep 0.5; \
		kill -9 $$pids 2>/dev/null || true; \
	fi
endef

define print_status
	if [ -f "$(2)" ] && kill -0 $$(cat "$(2)") 2>/dev/null; then \
		echo "  $(3): running (pid $$(cat $(2)))"; \
	else \
		echo "  $(3): stopped"; \
	fi
endef
