{
  description = "Harmony Web — Go + PostgreSQL Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
  let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    devShells.${system}.default = pkgs.mkShell {
      packages = with pkgs; [
        go
        postgresql
        git
      ];

      shellHook = ''
        export PGDATA=$PWD/.data/pgdata
        export PGHOST=$PWD/.data/pgrun
        export PGPORT=5433
        export PGDATABASE=harmony_web
        export PGUSER=$USER

        export DB_DSN="host=$PGHOST port=$PGPORT dbname=$PGDATABASE user=$PGUSER sslmode=disable"

        mkdir -p $PGDATA $PGHOST

        if [ ! -f $PGDATA/PG_VERSION ]; then
          echo "Inicializando cluster PostgreSQL..."
          initdb -D $PGDATA --auth=trust --username=$USER
        fi

        if ! pg_ctl -D $PGDATA status > /dev/null 2>&1; then
          echo "Iniciando PostgreSQL..."
          pg_ctl -D $PGDATA -l $PWD/.data/pglog -o "-k $PGHOST -p $PGPORT" start
          sleep 1
          createdb -h $PGHOST -p $PGPORT $PGDATABASE 2>/dev/null || true
        fi

        echo ""
        echo "-----------------------------------------------"
        echo " Harmony Web — Go + PostgreSQL Dev Shell"
        echo "-----------------------------------------------"
        echo " DB:   $PGDATABASE @ $PGHOST:$PGPORT"
        echo " DSN:  \$DB_DSN"
        echo ""
        echo " Stop: pg_ctl -D \$PGDATA stop"
        echo " Run:  go run main.go"
        echo "-----------------------------------------------"
        echo ""
      '';
    };
  };
}
