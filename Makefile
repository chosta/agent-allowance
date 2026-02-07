.PHONY: build test security lint clean fmt all

build:
	~/.foundry/bin/forge build

test:
	~/.foundry/bin/forge test -vvv

security:
	slither src/

lint:
	solhint 'src/**/*.sol' 'test/**/*.sol'

fmt:
	~/.foundry/bin/forge fmt

all: lint build test security
