#!/usr/bin/env perl
use Mojolicious::Lite;
use Data::Dump 'pp';

app->secret('1Y8+yLpkVo+VIRm/SSEsl0seCa840gOs');

my %clients = ();

get '/' => sub {
    my $self = shift;
    $self->render_static('test-canvas.html');
} => 'index';

websocket '/d' => sub {
    my $self = shift;
    my $id = sprintf("%s:%s", $self->tx->remote_address, $self->tx->remote_port);
    app->log->debug("got client $id");
    $clients{$id} = $self->tx;
    my $json = new Mojo::JSON;
    $self->on(message => sub {
        my ($self, $data) = @_;
        if ($data eq 'ping') {
            $self->send('pong');
            return;
        }
        app->log->debug("in: $data");
        $data = $json->decode($data);
        for my $cl (keys %clients) {
            next if $cl eq $id;
            app->log->debug("sending to $cl");
            $clients{$cl}->send($json->encode($data));
        }
    });

    $self->on(finish => sub {
        app->log->debug("disconnect: $id");  
        delete $clients{$id};
    });
};

$ENV{MOJO_INACTIVITY_TIMEOUT} = 0;
app->start;
